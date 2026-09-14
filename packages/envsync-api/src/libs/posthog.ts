import { AsyncLocalStorage } from "node:async_hooks";
import { PostHog } from "posthog-node";

import {
	detectAnalyticsSource,
	mapAuditActionToAnalyticsEvent,
	sanitizeAnalyticsProperties,
	type AnalyticsSource,
} from "envsync-analytics";

import { EditionPolicyService } from "@/services/edition-policy.service";
import { config } from "@/utils/env";
import infoLogs, { LogTypes } from "@/libs/logger";

type AnalyticsRequestContext = {
	source: AnalyticsSource;
	role_name?: string;
};

const requestContext = new AsyncLocalStorage<AnalyticsRequestContext>();

let client: PostHog | null = null;
let warnedMissing = false;

function posthogDisabled() {
	return config.ENVSYNC_POSTHOG_DISABLED === "true" || !config.POSTHOG_KEY;
}

export function getAnalyticsRequestContext() {
	return requestContext.getStore();
}

export function runWithAnalyticsContext<T>(ctx: AnalyticsRequestContext, fn: () => T): T {
	return requestContext.run(ctx, fn);
}

export function analyticsContextFromRequest(input: {
	userAgent?: string | null;
	clientHeader?: string | null;
	roleName?: string | null;
}): AnalyticsRequestContext {
	return {
		source: detectAnalyticsSource(input.userAgent ?? "", input.clientHeader),
		role_name: input.roleName ?? undefined,
	};
}

function getClient(): PostHog | null {
	if (posthogDisabled()) {
		return null;
	}
	if (!client) {
		client = new PostHog(config.POSTHOG_KEY as string, {
			host: config.POSTHOG_HOST,
			flushAt: 20,
			flushInterval: 10_000,
		});
	}
	return client;
}

export function captureProductEvent(input: {
	event: string;
	distinctId: string;
	orgId?: string;
	properties?: Record<string, string | number | boolean | null>;
}): void {
	const ph = getClient();
	if (!ph) {
		if (!warnedMissing && !config.POSTHOG_KEY && config.ENVSYNC_POSTHOG_DISABLED !== "true") {
			warnedMissing = true;
			infoLogs("PostHog disabled (POSTHOG_KEY unset)", LogTypes.LOGS, "PostHog");
		}
		return;
	}
	try {
		ph.capture({
			distinctId: input.distinctId,
			event: input.event,
			groups: input.orgId ? { organization: input.orgId } : undefined,
			properties: {
				...input.properties,
				edition: EditionPolicyService.getEdition(),
				deployment_mode: EditionPolicyService.getDeploymentMode(),
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		infoLogs(`PostHog capture failed: ${message}`, LogTypes.ERROR, "PostHog");
	}
}

export function captureAuditAnalytics(input: {
	action: string;
	org_id: string;
	user_id: string;
	details?: Record<string, unknown>;
}): void {
	const event = mapAuditActionToAnalyticsEvent(input.action);
	if (!event) return;
	const ctx = getAnalyticsRequestContext();
	captureProductEvent({
		event,
		distinctId: input.user_id || input.org_id || "anonymous",
		orgId: input.org_id,
		properties: {
			...sanitizeAnalyticsProperties(input.details),
			org_id: input.org_id,
			user_id: input.user_id || null,
			source: ctx?.source ?? "api",
			role_name: ctx?.role_name ?? null,
			audit_action: input.action,
		},
	});
}

export async function shutdownPostHog(): Promise<void> {
	if (!client) return;
	await client.shutdown();
	client = null;
}

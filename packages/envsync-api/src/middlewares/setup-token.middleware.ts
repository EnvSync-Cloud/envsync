import { timingSafeEqual } from "node:crypto";

import type { MiddlewareHandler } from "hono";

import { config } from "@/utils/env";
import { EditionPolicyService } from "@/services/edition-policy.service";

const SETUP_HEADER = "X-EnvSync-Setup-Token";

function tokensMatch(provided: string, expected: string) {
	const a = Buffer.from(provided);
	const b = Buffer.from(expected);
	if (a.length !== b.length) {
		return false;
	}
	return timingSafeEqual(a, b);
}

/**
 * Operator setup authentication for self-host org provisioning.
 * Requires ENVSYNC_SETUP_TOKEN and selfhosted deployment mode.
 */
export function setupTokenMiddleware(): MiddlewareHandler {
	return async (ctx, next) => {
		if (!EditionPolicyService.isSelfhosted()) {
			return ctx.json(
				{
					error: "Setup API is only available on self-hosted deployments.",
					code: "SETUP_SELFHOSTED_ONLY",
				},
				403,
			);
		}

		const expected = config.ENVSYNC_SETUP_TOKEN?.trim() ?? "";
		if (!expected) {
			return ctx.json(
				{
					error: "Setup token is not configured on this deployment.",
					code: "SETUP_TOKEN_NOT_CONFIGURED",
				},
				503,
			);
		}

		const provided = ctx.req.header(SETUP_HEADER)?.trim() ?? "";
		if (!provided || !tokensMatch(provided, expected)) {
			return ctx.json(
				{
					error: "Invalid or missing setup token.",
					code: "SETUP_TOKEN_INVALID",
				},
				401,
			);
		}

		await next();
	};
}

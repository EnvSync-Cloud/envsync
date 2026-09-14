import { ANALYTICS_PROPERTY_DENYLIST } from "./events";

/**
 * Audit mutations that become PostHog outcomes.
 * View/list actions are omitted on purpose.
 */
export const AUDIT_TO_ANALYTICS: Record<string, string> = {
	app_created: "app_created",
	app_updated: "app_updated",
	app_deleted: "app_deleted",
	env_type_created: "env_type_created",
	env_type_updated: "env_type_updated",
	env_type_deleted: "env_type_deleted",
	env_created: "env_upserted",
	env_updated: "env_upserted",
	env_deleted: "env_deleted",
	envs_batch_created: "env_upserted",
	envs_batch_updated: "env_upserted",
	envs_batch_deleted: "env_deleted",
	secret_created: "secret_upserted",
	secret_updated: "secret_upserted",
	secret_deleted: "secret_deleted",
	secrets_batch_created: "secret_upserted",
	secrets_batch_updated: "secret_upserted",
	secrets_batch_deleted: "secret_deleted",
	org_created: "org_created",
	org_updated: "org_updated",
	user_invite_created: "user_invited",
	user_invite_accepted: "user_invite_accepted",
	user_deleted: "user_removed",
	user_role_updated: "user_role_changed",
	role_created: "role_created",
	role_updated: "role_updated",
	role_deleted: "role_deleted",
	team_created: "team_created",
	team_updated: "team_updated",
	team_deleted: "team_deleted",
	apikey_created: "api_key_created",
	apikey_deleted: "api_key_deleted",
	service_token_created: "service_token_created",
	service_token_rotated: "service_token_rotated",
	service_token_deleted: "service_token_deleted",
	webhook_created: "webhook_created",
	webhook_updated: "webhook_updated",
	webhook_deleted: "webhook_deleted",
	change_request_created: "change_request_opened",
	change_request_approved: "change_request_resolved",
	change_request_rejected: "change_request_resolved",
	change_request_cancelled: "change_request_resolved",
	saml_provider_created: "sso_provider_saved",
	saml_provider_updated: "sso_provider_saved",
	saml_provider_deleted: "sso_provider_deleted",
	saml_sso_start: "sso_login_started",
	saml_sso_success: "sso_login_succeeded",
	saml_sso_failure: "sso_login_failed",
	oidc_provider_created: "oidc_provider_saved",
	oidc_provider_updated: "oidc_provider_saved",
	kms_source_changed: "kms_config_updated",
	kms_verify: "kms_verified",
	kms_dek_rewrap_enqueued: "kms_attach_enqueued",
	kms_detach_enqueued: "kms_detach_enqueued",
	enterprise_provider_connection_created: "integration_connected",
	enterprise_sync_run_created: "sync_run_started",
};

const DENY = new Set<string>(ANALYTICS_PROPERTY_DENYLIST);

export function mapAuditActionToAnalyticsEvent(action: string): string | null {
	return AUDIT_TO_ANALYTICS[action] ?? null;
}

export function sanitizeAnalyticsProperties(
	details: Record<string, unknown> | undefined,
): Record<string, string | number | boolean | null> {
	const out: Record<string, string | number | boolean | null> = {};
	if (!details) return out;
	for (const [key, value] of Object.entries(details)) {
		if (DENY.has(key.toLowerCase())) continue;
		if (value === undefined) continue;
		if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
			out[key] = value;
		}
	}
	return out;
}

export function detectAnalyticsSource(userAgent: string, clientHeader?: string | null): "web" | "cli" | "sdk" | "api" {
	const explicit = clientHeader?.trim().toLowerCase();
	if (explicit === "web" || explicit === "cli" || explicit === "sdk" || explicit === "api") {
		return explicit;
	}
	const ua = userAgent.toLowerCase();
	if (ua.includes("envsync-cli") || ua.includes("envsync-go")) return "cli";
	if (ua.includes("envsync-ts-sdk") || ua.includes("envsync-go-sdk")) return "sdk";
	if (ua.includes("mozilla/") || ua.includes("chrome/") || ua.includes("safari/") || ua.includes("firefox/")) {
		return "web";
	}
	return "api";
}

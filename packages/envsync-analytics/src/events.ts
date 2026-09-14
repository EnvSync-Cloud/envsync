export const ANALYTICS_SOURCES = ["web", "cli", "sdk", "api"] as const;
export type AnalyticsSource = (typeof ANALYTICS_SOURCES)[number];

/** Browser intent events. Not emitted from the API audit adapter. */
export const BROWSER_EVENTS = [
	"landing_cta_clicked",
	"landing_docs_clicked",
	"landing_github_clicked",
	"org_signup_started",
	"org_signup_completed",
	"org_signup_failed",
	"org_onboarding_completed",
	"user_invite_accept_started",
	"user_invite_accept_completed",
	"user_invite_accept_failed",
	"login_started",
	"login_completed",
	"login_failed",
	"logout",
	"org_switched",
	"upgrade_gate_viewed",
	"empty_state_viewed",
	"app_create_started",
	"secret_editor_opened",
	"env_type_create_started",
	"sso_test_login_started",
	"kms_attach_started",
	"integration_sync_started",
] as const;

export type BrowserAnalyticsEvent = (typeof BROWSER_EVENTS)[number];

export const ANALYTICS_PROPERTY_DENYLIST = [
	"value",
	"plaintext",
	"ciphertext",
	"password",
	"token",
	"access_token",
	"refresh_token",
	"secret",
	"private_key",
	"wrapped_kek",
	"metadata_xml",
	"saml_response",
	"key_pem",
	"cert_pem",
] as const;

export type AnalyticsPropertyMap = Record<string, string | number | boolean | null>;

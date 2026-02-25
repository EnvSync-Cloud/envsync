/**
 * Global test preload — sets env vars and mocks external modules
 * before any application code is imported.
 *
 * Loaded via bunfig.toml [test].preload
 *
 * When TEST_MODE=e2e, this file is a no-op — E2E tests use their own setup
 * loaded via --preload flag.
 */
import { mock } from "bun:test";

const isE2E = process.env.TEST_MODE === "e2e";

// ── 1. Set required environment variables ────────────────────────────
// Must happen before any import of @/utils/env which calls env.parse(process.env)
if (!isE2E) {
	Object.assign(process.env, {
		NODE_ENV: "development",
		PORT: "0",
		// SpacetimeDB
		STDB_URL: "http://localhost:3000",
		STDB_DB_NAME: "envsync-test",
		STDB_ROOT_KEY: "test-root-key",
		// S3
		S3_BUCKET: "test-bucket",
		S3_REGION: "us-east-1",
		S3_ACCESS_KEY: "testaccesskey",
		S3_SECRET_KEY: "testsecretkey",
		S3_BUCKET_URL: "http://localhost:9000/test-bucket",
		S3_ENDPOINT: "http://localhost:9000",
		// Cache
		CACHE_ENV: "development",
		// SMTP
		SMTP_HOST: "localhost",
		SMTP_PORT: "1025",
		SMTP_SECURE: "false",
		SMTP_FROM: "test@envsync.local",
		// Keycloak
		KEYCLOAK_URL: "http://localhost:8080",
		KEYCLOAK_REALM: "envsync",
		KEYCLOAK_ADMIN_USER: "admin",
		KEYCLOAK_ADMIN_PASSWORD: "admin",
		KEYCLOAK_WEB_CLIENT_ID: "envsync-web",
		KEYCLOAK_WEB_CLIENT_SECRET: "test-web-secret",
		KEYCLOAK_CLI_CLIENT_ID: "envsync-cli",
		KEYCLOAK_API_CLIENT_ID: "envsync-api",
		KEYCLOAK_API_CLIENT_SECRET: "test-api-secret",
		KEYCLOAK_WEB_REDIRECT_URI: "http://localhost:3000/callback",
		KEYCLOAK_WEB_CALLBACK_URL: "http://localhost:3000",
		KEYCLOAK_API_REDIRECT_URI: "http://localhost:4000/callback",
		// App URLs
		LANDING_PAGE_URL: "http://localhost:3000",
		DASHBOARD_URL: "http://localhost:8080",
	});

	// ── 2. Mock external modules ─────────────────────────────────────────
	// These must be registered before any app code is imported.

	// Prevent loadRootEnv from overwriting test env vars with values from .env
	mock.module("@/utils/load-root-env", () => ({
		loadRootEnv: () => {},
		findMonorepoRoot: () => process.cwd(),
		updateRootEnv: () => {},
	}));

	// Mock JWT verification — token format: "test-token-<auth_service_id>"
	mock.module("@/helpers/jwt", () => ({
		verifyJWTToken: async (token: string) => {
			const sub = token.replace("test-token-", "");
			return { sub, iss: "http://localhost:8080/realms/envsync", aud: "test" };
		},
	}));

	// Mock Keycloak helpers — no-op user management
	mock.module("@/helpers/keycloak", () => ({
		getKeycloakIssuer: () => "http://localhost:8080/realms/envsync",
		createKeycloakUser: async (payload: any) => ({
			id: `kc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		}),
		updateKeycloakUser: async () => {},
		deleteKeycloakUser: async () => {},
		sendKeycloakPasswordReset: async () => {},
		keycloakTokenExchange: async (code: string) => ({
			access_token: `mock-access-token-${code}`,
			id_token: `mock-id-token-${code}`,
		}),
	}));

	// Mock Mail — no-op, captures calls
	mock.module("@/libs/mail/index", () => ({
		onOrgOnboardingInvite: async (...args: any[]) => {
			mailCalls.push({ fn: "onOrgOnboardingInvite", args });
		},
		onUserOnboardingInvite: async (...args: any[]) => {
			mailCalls.push({ fn: "onUserOnboardingInvite", args });
		},
	}));

	// Mock Webhooks — capture-only
	mock.module("@/libs/webhooks/index", () => ({
		WebhookHandler: {
			triggerWebhook: async (url: string, payload: any, type: string) => {
				webhookCalls.push({ url, payload, type });
			},
		},
	}));

	// ── 3. Initialize cache in development mode ──────────────────────────
	// Use dynamic import to ensure env vars and mocks are registered first
	// (static imports are hoisted before mock.module and Object.assign calls)
	const { CacheClient } = await import("@/libs/cache");
	CacheClient.init("development");
}

// Captured calls for test assertions (empty in E2E mode)
export const mailCalls: { fn: string; args: any[] }[] = [];
export const webhookCalls: { url: string; payload: any; type: string }[] = [];

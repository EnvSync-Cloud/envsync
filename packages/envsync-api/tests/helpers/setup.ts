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
		DB_LOGGING: "false",
		DB_AUTO_MIGRATE: "true",
		DATABASE_SSL: "false",
		DATABASE_HOST: process.env.DATABASE_HOST ?? "localhost",
		DATABASE_PORT: process.env.DATABASE_PORT ?? "5432",
		DATABASE_USER: process.env.DATABASE_USER ?? "postgres",
		DATABASE_PASSWORD: process.env.DATABASE_PASSWORD ?? "postgres",
		DATABASE_NAME: "envsync_test",
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
		// Zitadel
		ZITADEL_URL: "http://localhost:8080",
		ZITADEL_PAT: "test-pat",
		ZITADEL_WEB_CLIENT_ID: "test-web-client-id",
		ZITADEL_WEB_CLIENT_SECRET: "test-web-client-secret",
		ZITADEL_CLI_CLIENT_ID: "test-cli-client-id",
		ZITADEL_CLI_CLIENT_SECRET: "test-cli-client-secret",
		ZITADEL_API_CLIENT_ID: "test-api-client-id",
		ZITADEL_API_CLIENT_SECRET: "test-api-client-secret",
		ZITADEL_WEB_REDIRECT_URI: "http://localhost:3000/callback",
		ZITADEL_WEB_CALLBACK_URL: "http://localhost:3000",
		ZITADEL_API_REDIRECT_URI: "http://localhost:4000/callback",
		// Vault
		VAULT_ADDR: "http://localhost:8200",
		VAULT_ROLE_ID: "test-role-id",
		VAULT_SECRET_ID: "test-secret-id",
		VAULT_MOUNT_PATH: "envsync",
		// miniKMS
		MINIKMS_GRPC_ADDR: "localhost:50051",
		MINIKMS_TLS_ENABLED: "false",
		// OpenFGA
		OPENFGA_API_URL: "http://localhost:8090",
		OPENFGA_STORE_ID: "test-store-id",
		OPENFGA_MODEL_ID: "test-model-id",
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
			return { sub, iss: "http://localhost:8080", aud: "test" };
		},
	}));

	// Mock Zitadel helpers — no-op user management
	mock.module("@/helpers/zitadel", () => ({
		getZitadelIssuer: () => "http://localhost:8080",
		createZitadelUser: async (payload: any) => ({
			id: `zitadel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		}),
		updateZitadelUser: async () => {},
		deleteZitadelUser: async () => {},
		sendZitadelPasswordReset: async () => {},
		zitadelTokenExchange: async (code: string) => ({
			access_token: `mock-access-token-${code}`,
			id_token: `mock-id-token-${code}`,
		}),
	}));

	// Mock Vault — in-memory KV v2 implementation
	const { MockVaultClient } = await import("./vault");

	mock.module("@/libs/vault/index", () => ({
		VaultClient: {
			getInstance: async () => MockVaultClient,
		},
	}));

	// Mock KMS — in-memory AES-256-GCM with deterministic test keys
	const { MockKMSClient } = await import("./kms");

	mock.module("@/libs/kms/client", () => ({
		KMSClient: {
			getInstance: async () => MockKMSClient,
		},
	}));

	// Mock OpenFGA — in-memory tuple store with hierarchy resolution
	const { MockFGAClient } = await import("./fga");

	mock.module("@/libs/openfga/index", () => ({
		FGAClient: {
			getInstance: async () => MockFGAClient,
		},
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

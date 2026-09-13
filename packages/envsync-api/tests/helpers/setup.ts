/**
 * Global test preload — sets env vars and mocks external modules
 * before any application code is imported.
 *
 * Loaded via bunfig.toml [test].preload
 *
 * When TEST_MODE=e2e, this file is a no-op — E2E tests use their own setup
 * loaded via --preload flag.
 */
import { spawnSync } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { mock } from "bun:test";

const isE2E = process.env.TEST_MODE === "e2e";

function run(cmd: string, args: string[], cwd?: string) {
	const result = spawnSync(cmd, args, {
		stdio: "pipe",
		encoding: "utf8",
		env: process.env,
		cwd,
	});
	if (result.status !== 0) {
		const stderr = result.stderr?.trim();
		throw new Error(`Command failed: ${cmd} ${args.join(" ")}${stderr ? `\n${stderr}` : ""}`);
	}
	return result.stdout?.trim() ?? "";
}

function findMonorepoRoot(): string {
	let dir = process.cwd();
	for (;;) {
		if (fs.existsSync(path.join(dir, "docker-compose.yaml"))) {
			return dir;
		}
		const parent = path.dirname(dir);
		if (parent === dir) {
			throw new Error("Could not find monorepo root for mock test Docker fallback.");
		}
		dir = parent;
	}
}

async function canConnect(host: string, port: number) {
	return new Promise<boolean>(resolve => {
		const socket = net.createConnection(port, host, () => {
			socket.destroy();
			resolve(true);
		});
		socket.on("error", () => resolve(false));
		socket.setTimeout(1000, () => {
			socket.destroy();
			resolve(false);
		});
	});
}

async function waitForPort(host: string, port: number, attempts = 30) {
	for (let attempt = 0; attempt < attempts; attempt++) {
		const ready = await canConnect(host, port);
		if (ready) return;
		await Bun.sleep(1000);
	}
	throw new Error(`Postgres did not become reachable at ${host}:${port}`);
}

async function ensureMockPostgres() {
	const host = process.env.DATABASE_HOST ?? "localhost";
	const port = Number(process.env.DATABASE_PORT ?? "5432");
	if (!(await canConnect(host, port))) {
		const dockerInfo = spawnSync("docker", ["info"], {
			stdio: "pipe",
			encoding: "utf8",
			env: process.env,
		});
		if (dockerInfo.status !== 0) {
			const stderr = dockerInfo.stderr?.trim();
			throw new Error(
				[
					`Mock tests need Postgres at ${host}:${port}, or a reachable Docker daemon for fallback bootstrap.`,
					"Postgres was not reachable and Docker fallback is unavailable.",
					stderr ? `Docker error: ${stderr}` : undefined,
				].filter(Boolean).join("\n"),
			);
		}

		run("docker", ["compose", "up", "-d", "postgres"], findMonorepoRoot());
	}

	await waitForPort(host, port);
	const dbName = process.env.DATABASE_NAME ?? "envsync_test";
	const dbUser = process.env.DATABASE_USER ?? "postgres";
	const dbPassword = process.env.DATABASE_PASSWORD ?? "postgres";
	const adminDb = process.env.DATABASE_ADMIN_NAME ?? "postgres";
	if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
		throw new Error(`Mock tests refuse to create an invalid database name: '${dbName}'`);
	}

	const { Client } = await import("pg");
	const adminClient = new Client({
		host,
		port,
		user: dbUser,
		password: dbPassword,
		database: adminDb,
		ssl: false,
	});

	try {
		await adminClient.connect();
		const exists = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
		if (exists.rowCount !== 1) {
			await adminClient.query(`CREATE DATABASE "${dbName}"`);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Mock tests could not prepare database '${dbName}'.\n${message}`);
	} finally {
		await adminClient.end().catch(() => {});
	}
}

// ── 1. Set required environment variables ────────────────────────────
// Must happen before any import of @/utils/env which calls env.parse(process.env)
if (!isE2E) {
	await (async () => {
		Object.assign(process.env, {
			NODE_ENV: "development",
			PORT: "0",
			DB_LOGGING: "false",
			DB_AUTO_MIGRATE: "true",
			DATABASE_SSL: "false",
			DATABASE_HOST: process.env.DATABASE_HOST ?? "127.0.0.1",
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
			// Keycloak
			KEYCLOAK_URL: "http://localhost:8080",
			KEYCLOAK_REALM: "envsync",
			KEYCLOAK_ADMIN_USER: "admin",
			KEYCLOAK_ADMIN_PASSWORD: "admin",
			KEYCLOAK_WEB_CLIENT_ID: "envsync-web",
			KEYCLOAK_WEB_CLIENT_SECRET: "test-web-client-secret",
			KEYCLOAK_CLI_CLIENT_ID: "envsync-cli",
			KEYCLOAK_API_CLIENT_ID: "envsync-api",
			KEYCLOAK_API_CLIENT_SECRET: "test-api-client-secret",
			KEYCLOAK_WEB_REDIRECT_URI: "http://api.lvh.me:4000/api/access/web/callback",
			KEYCLOAK_WEB_CALLBACK_URL: "http://app.lvh.me:8001/auth/callback",
			KEYCLOAK_API_REDIRECT_URI: "http://api.lvh.me:4000/api/access/api/callback",
			// miniKMS
			MINIKMS_GRPC_ADDR: "localhost:50051",
			MINIKMS_TLS_ENABLED: "false",
			// OpenFGA
			OPENFGA_API_URL: "http://localhost:8090",
			OPENFGA_STORE_ID: "test-store-id",
			OPENFGA_MODEL_ID: "test-model-id",
			// App URLs
			LANDING_PAGE_URL: "http://localhost:8002",
			DASHBOARD_URL: "http://app.lvh.me:8001",
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

			// Mock Keycloak helpers — no-op user management
			mock.module("@/helpers/keycloak", () => ({
				getKeycloakBaseUrl: () => "http://localhost:8080",
				getKeycloakPublicBaseUrl: () => "http://localhost:8080",
				getKeycloakIssuer: () => "http://localhost:8080/realms/envsync",
				getKeycloakRealm: () => "envsync",
				createKeycloakUser: async () => ({
					id: `keycloak-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
				}),
				updateKeycloakUser: async () => {},
				deleteKeycloakUser: async () => {},
				sendKeycloakPasswordReset: async () => {},
				findKeycloakUserByUsername: async () => null,
				getKeycloakUserById: async () => null,
				setKeycloakUserPassword: async () => {},
				keycloakUserHasPassword: async () => true,
				keycloakTokenExchange: async (code: string) => ({
					access_token: `mock-access-token-${code}`,
					id_token: `mock-id-token-${code}`,
					refresh_token: `mock-refresh-token-${code}`,
					expires_in: 900,
					refresh_expires_in: 86400,
				}),
				keycloakPasswordLogin: async (username: string, _password: string) => ({
					access_token: `mock-password-access-token-${username}`,
					id_token: `mock-password-id-token-${username}`,
					refresh_token: `mock-password-refresh-token-${username}`,
					expires_in: 900,
					refresh_expires_in: 86400,
				}),
				keycloakRefreshToken: async (refreshToken: string) => ({
					access_token: `mock-refreshed-access-token-${refreshToken}`,
					refresh_token: refreshToken,
					expires_in: 900,
					refresh_expires_in: 86400,
				}),
			}));

		// Mock KMS — in-memory AES-256-GCM with deterministic test keys + Vault + Session mocks
		const { MockKMSClient } = await import("./kms");

		mock.module("@/libs/kms/client", () => ({
			KMSClient: {
				getInstance: async () => MockKMSClient,
			},
		}));

		// Mock session-manager — returns a static token for vault operations
		mock.module("@/libs/kms/session-manager", () => ({
			getVaultSessionToken: async () => "mock-session-token",
			invalidateSessionToken: () => {},
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
		await ensureMockPostgres();

		const { CacheClient } = await import("@/libs/cache");
		CacheClient.init("development");

		const { cleanupDB } = await import("./db");
		await cleanupDB();
	})().catch(error => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}

// Captured calls for test assertions (empty in E2E mode)
export const mailCalls: { fn: string; args: any[] }[] = [];
export const webhookCalls: { url: string; payload: any; type: string }[] = [];

/**
 * E2E test preload — zero mock.module() calls.
 *
 * All services are real:
 * - JWT verification → real Zitadel JWKS endpoint
 * - Vault → real Vault with AppRole auth
 * - OpenFGA → real OpenFGA (auto-bootstraps store+model)
 * - Mail → real Mailpit SMTP
 * - Zitadel → real Zitadel for user management + token issuance
 *
 * Prerequisites:
 *   1. Run `bun run e2e:init` (or `bun run scripts/e2e-setup.ts init`) to set up services
 *   2. Docker services must be running (postgres, redis, vault, openfga, mailpit, zitadel)
 *
 * Usage: TEST_MODE=e2e bun test tests/e2e --preload tests/e2e/helpers/real-setup.ts
 */

import fs from "node:fs";
import path from "node:path";

// ── 1. Prevent loadRootEnv from overwriting test env vars ────────────
process.env.SKIP_ROOT_ENV = "1";

// ── 2. Load .env.e2e.test for Vault/service/Zitadel credentials ─────
const projectRoot = findProjectRoot();
const envE2EPath = path.join(projectRoot, ".env.e2e.test");
if (fs.existsSync(envE2EPath)) {
	loadEnvFileSimple(envE2EPath);
	console.log(`[E2E Setup] Loaded credentials from ${envE2EPath}`);
} else {
	console.log(`[E2E Setup] WARNING: ${envE2EPath} not found. Run 'bun run e2e:init' first.`);
}

// ── 3. Set all required environment variables ────────────────────────
// Vault creds come from .env.e2e.test (loaded above)
// ZITADEL_URL points to real Zitadel instance
const zitadelUrl = process.env.ZITADEL_URL ?? "http://localhost:8080";

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
	DATABASE_NAME: "envsync_e2e_test",
	// S3 — real RustFS from docker-compose
	S3_BUCKET: process.env.S3_BUCKET ?? "envsync",
	S3_REGION: process.env.S3_REGION ?? "us-east-1",
	S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? "rustfsadmin",
	S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? "rustfsadmin",
	S3_BUCKET_URL: process.env.S3_BUCKET_URL ?? "http://localhost:19001/envsync",
	S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:19001",
	// Cache — use development mode (node-cache, no Redis dependency)
	CACHE_ENV: "development",
	// SMTP — real Mailpit
	SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
	SMTP_PORT: process.env.SMTP_PORT ?? "1025",
	SMTP_SECURE: "false",
	SMTP_FROM: "test@envsync.local",
	// Zitadel — real instance
	ZITADEL_URL: zitadelUrl,
	ZITADEL_PAT: process.env.ZITADEL_PAT,
	ZITADEL_LOGIN_PAT: process.env.ZITADEL_LOGIN_PAT ?? process.env.ZITADEL_PAT,
	ZITADEL_WEB_CLIENT_ID: process.env.ZITADEL_WEB_CLIENT_ID ?? "test-web-client-id",
	ZITADEL_WEB_CLIENT_SECRET: process.env.ZITADEL_WEB_CLIENT_SECRET ?? "test-web-client-secret",
	ZITADEL_CLI_CLIENT_ID: process.env.ZITADEL_CLI_CLIENT_ID ?? "test-cli-client-id",
	ZITADEL_CLI_CLIENT_SECRET: process.env.ZITADEL_CLI_CLIENT_SECRET ?? "test-cli-client-secret",
	ZITADEL_API_CLIENT_ID: process.env.ZITADEL_API_CLIENT_ID ?? "test-api-client-id",
	ZITADEL_API_CLIENT_SECRET: process.env.ZITADEL_API_CLIENT_SECRET ?? "test-api-client-secret",
	ZITADEL_WEB_REDIRECT_URI: process.env.ZITADEL_WEB_REDIRECT_URI ?? "http://localhost:3000/callback",
	ZITADEL_WEB_CALLBACK_URL: process.env.ZITADEL_WEB_CALLBACK_URL ?? "http://localhost:3000",
	ZITADEL_API_REDIRECT_URI: process.env.ZITADEL_API_REDIRECT_URI ?? "http://localhost:4000/callback",
	// Vault — real credentials from .env.e2e.test (already loaded)
	VAULT_ADDR: process.env.VAULT_ADDR ?? "http://localhost:8200",
	VAULT_ROLE_ID: process.env.VAULT_ROLE_ID,
	VAULT_SECRET_ID: process.env.VAULT_SECRET_ID,
	VAULT_MOUNT_PATH: process.env.VAULT_MOUNT_PATH ?? "envsync",
	// OpenFGA — real OpenFGA (auto-bootstraps store+model)
	OPENFGA_API_URL: process.env.OPENFGA_API_URL ?? "http://localhost:8090",
	OPENFGA_STORE_ID: process.env.OPENFGA_STORE_ID ?? "",
	OPENFGA_MODEL_ID: process.env.OPENFGA_MODEL_ID ?? "",
	// miniKMS
	MINIKMS_GRPC_ADDR: process.env.MINIKMS_GRPC_ADDR ?? "localhost:50051",
	MINIKMS_TLS_ENABLED: "false",
	// App URLs
	LANDING_PAGE_URL: "http://localhost:3000",
	DASHBOARD_URL: "http://localhost:9090",
});

// ── 4. Initialize cache ─────────────────────────────────────────────
const { CacheClient } = await import("@/libs/cache");
CacheClient.init("development");

// ── 5. Initialize DB and run migrations ─────────────────────────────
const { DB } = await import("@/libs/db");
await DB.getInstance();
console.log("[E2E Setup] Database initialized and migrations applied.");
console.log("[E2E Setup] All services are REAL — zero mock.module() calls.");

// ── Helpers ─────────────────────────────────────────────────────────

function findProjectRoot(): string {
	let dir = path.resolve(import.meta.dir, "../../..");
	// Walk up until we find package.json with name "envsync-api"
	for (;;) {
		if (fs.existsSync(path.join(dir, "package.json"))) {
			try {
				const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
				if (pkg.name === "envsync-api") return dir;
			} catch {}
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	// Fallback: use import.meta.dir relative path
	return path.resolve(import.meta.dir, "../../..");
}

function loadEnvFileSimple(filePath: string): void {
	const content = fs.readFileSync(filePath, "utf8");
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1).replace(/\\"/g, '"');
		}
		if (key) process.env[key] = value;
	}
}

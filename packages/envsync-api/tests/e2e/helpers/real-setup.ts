/**
 * E2E test preload — zero mock.module() calls.
 *
 * All services are real:
 * - JWT verification → real Keycloak JWKS endpoint
 * - SpacetimeDB → real STDB for data + authorization
 * - Mail → real Mailpit SMTP
 * - Keycloak → real Keycloak for user management + token issuance
 *
 * Prerequisites:
 *   1. Run `bun run e2e:init` (or `bun run scripts/e2e-setup.ts init`) to set up services
 *   2. Docker services must be running (spacetimedb, redis, keycloak, mailpit)
 *
 * Usage: TEST_MODE=e2e bun test tests/e2e --preload tests/e2e/helpers/real-setup.ts
 */

import fs from "node:fs";
import path from "node:path";

// ── 1. Prevent loadRootEnv from overwriting test env vars ────────────
process.env.SKIP_ROOT_ENV = "1";

// ── 2. Load .env.e2e.test for service credentials ────────────────────
const projectRoot = findProjectRoot();
const envE2EPath = path.join(projectRoot, ".env.e2e.test");
if (fs.existsSync(envE2EPath)) {
	loadEnvFileSimple(envE2EPath);
	console.log(`[E2E Setup] Loaded credentials from ${envE2EPath}`);
} else {
	console.log(`[E2E Setup] WARNING: ${envE2EPath} not found. Run 'bun run e2e:init' first.`);
}

// ── 3. Set all required environment variables ────────────────────────
const keycloakUrl = process.env.KEYCLOAK_URL ?? "http://localhost:8080";

Object.assign(process.env, {
	NODE_ENV: "development",
	PORT: "0",
	// SpacetimeDB
	STDB_URL: process.env.STDB_URL ?? "http://localhost:3000",
	STDB_DB_NAME: process.env.STDB_DB_NAME ?? "envsync-e2e-test",
	STDB_AUTH_TOKEN: process.env.STDB_AUTH_TOKEN ?? "",
	STDB_ROOT_KEY: process.env.STDB_ROOT_KEY ?? "e2e-test-root-key",
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
	// Keycloak — real instance
	KEYCLOAK_URL: keycloakUrl,
	KEYCLOAK_REALM: process.env.KEYCLOAK_REALM ?? "envsync",
	KEYCLOAK_ADMIN_USER: process.env.KEYCLOAK_ADMIN_USER ?? "admin",
	KEYCLOAK_ADMIN_PASSWORD: process.env.KEYCLOAK_ADMIN_PASSWORD ?? "admin",
	KEYCLOAK_WEB_CLIENT_ID: process.env.KEYCLOAK_WEB_CLIENT_ID ?? "envsync-web",
	KEYCLOAK_WEB_CLIENT_SECRET: process.env.KEYCLOAK_WEB_CLIENT_SECRET ?? "test-web-secret",
	KEYCLOAK_CLI_CLIENT_ID: process.env.KEYCLOAK_CLI_CLIENT_ID ?? "envsync-cli",
	KEYCLOAK_API_CLIENT_ID: process.env.KEYCLOAK_API_CLIENT_ID ?? "envsync-api",
	KEYCLOAK_API_CLIENT_SECRET: process.env.KEYCLOAK_API_CLIENT_SECRET ?? "test-api-secret",
	KEYCLOAK_WEB_REDIRECT_URI: process.env.KEYCLOAK_WEB_REDIRECT_URI ?? "http://localhost:3000/callback",
	KEYCLOAK_WEB_CALLBACK_URL: process.env.KEYCLOAK_WEB_CALLBACK_URL ?? "http://localhost:3000",
	KEYCLOAK_API_REDIRECT_URI: process.env.KEYCLOAK_API_REDIRECT_URI ?? "http://localhost:4000/callback",
	// App URLs
	LANDING_PAGE_URL: "http://localhost:3000",
	DASHBOARD_URL: "http://localhost:9090",
});

// ── 4. Initialize cache ─────────────────────────────────────────────
const { CacheClient } = await import("@/libs/cache");
CacheClient.init("development");

// ── 5. Verify STDB connectivity ─────────────────────────────────────
const { STDBClient } = await import("@/libs/stdb");
const stdb = STDBClient.getInstance();
const healthy = await stdb.healthCheck();
if (healthy) {
	console.log("[E2E Setup] SpacetimeDB connected and healthy.");
} else {
	console.log("[E2E Setup] WARNING: SpacetimeDB health check failed.");
}
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

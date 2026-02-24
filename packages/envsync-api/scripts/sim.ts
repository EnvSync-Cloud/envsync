#!/usr/bin/env bun
/**
 * High-Throughput Full-API Traffic Simulator
 *
 * Generates high-volume realistic traffic across all 115+ API endpoints.
 * 18 weighted scenarios simulate real-life user workflows to populate
 * Grafana/Tempo dashboards with meaningful traces and metrics.
 *
 * Architecture:
 *   - Configurable concurrent workers running weighted-random scenarios in tight loops
 *   - ResourcePoolManager refreshes DB lookups every 30s for realistic IDs
 *   - MetricsCollector reports RPS, p50/p95/p99 latency every 5s
 *   - Graceful shutdown on SIGINT/SIGTERM
 *
 * Environment variables:
 *   SIM_WORKERS      - Number of concurrent worker pools (default: 200, ~20K RPS)
 *                      Use 1000 for ~100K RPS
 *   SIM_DELAY_MS     - Inter-request delay in ms (default: 0)
 *   SIM_MAX_SAMPLES  - Max latency samples for percentile calculation (default: 100000)
 *   SIM_TIMEOUT_MS   - Per-request timeout in ms (default: 30000)
 *
 * Prerequisites:
 *   1. Docker services running: `docker compose up -d`
 *   2. E2E init completed: `bun run e2e:init`
 *   3. API server running: `bun run dev`
 *
 * Usage: bun run sim
 *        SIM_WORKERS=500 bun run sim    # ~50K RPS
 *        SIM_WORKERS=1000 bun run sim   # ~100K RPS
 */

import fs from "node:fs";
import path from "node:path";

// ── 1. Prevent loadRootEnv from overwriting env vars ─────────────────
process.env.SKIP_ROOT_ENV = "1";

// ── 2. Load root .env then .env.e2e.test credentials ─────────────────
const projectRoot = findProjectRoot();
const monorepoRoot = path.resolve(projectRoot, "../..");

// Load monorepo root .env first (DATABASE_NAME, PORT, etc.)
const rootEnvPath = path.join(monorepoRoot, ".env");
if (fs.existsSync(rootEnvPath)) {
	loadEnvFileSimple(rootEnvPath);
	console.log(`[Sim] Loaded root env from ${rootEnvPath}`);
}

// Layer E2E-specific credentials (Vault, Zitadel, FGA)
const envE2EPath = path.join(projectRoot, ".env.e2e.test");
if (fs.existsSync(envE2EPath)) {
	loadEnvFileSimple(envE2EPath);
	console.log(`[Sim] Loaded E2E credentials from ${envE2EPath}`);
} else {
	console.error(`[Sim] ERROR: ${envE2EPath} not found. Run 'bun run e2e:init' first.`);
	process.exit(1);
}

// ── 3. Set required environment variables ────────────────────────────
const zitadelUrl = process.env.ZITADEL_URL ?? "http://localhost:8080";

Object.assign(process.env, {
	NODE_ENV: "development",
	PORT: process.env.PORT ?? "4000",
	DB_LOGGING: "false",
	DB_AUTO_MIGRATE: "true",
	DATABASE_SSL: "false",
	DATABASE_HOST: process.env.DATABASE_HOST ?? "localhost",
	DATABASE_PORT: process.env.DATABASE_PORT ?? "5432",
	DATABASE_USER: process.env.DATABASE_USER ?? "postgres",
	DATABASE_PASSWORD: process.env.DATABASE_PASSWORD ?? "postgres",
	DATABASE_NAME: process.env.DATABASE_NAME ?? "envsync",
	S3_BUCKET: process.env.S3_BUCKET ?? "envsync",
	S3_REGION: process.env.S3_REGION ?? "us-east-1",
	S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? "rustfsadmin",
	S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? "rustfsadmin",
	S3_BUCKET_URL: process.env.S3_BUCKET_URL ?? "http://localhost:19001/envsync",
	S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:19001",
	CACHE_ENV: "production",
	SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
	SMTP_PORT: process.env.SMTP_PORT ?? "1025",
	SMTP_SECURE: "false",
	SMTP_FROM: "sim@envsync.local",
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
	VAULT_ADDR: process.env.VAULT_ADDR ?? "http://localhost:8200",
	VAULT_ROLE_ID: process.env.VAULT_ROLE_ID,
	VAULT_SECRET_ID: process.env.VAULT_SECRET_ID,
	VAULT_MOUNT_PATH: process.env.VAULT_MOUNT_PATH ?? "envsync",
	OPENFGA_API_URL: process.env.OPENFGA_API_URL ?? "http://localhost:8090",
	OPENFGA_STORE_ID: process.env.OPENFGA_STORE_ID ?? "",
	OPENFGA_MODEL_ID: process.env.OPENFGA_MODEL_ID ?? "",
	MINIKMS_GRPC_ADDR: process.env.MINIKMS_GRPC_ADDR ?? "localhost:50051",
	MINIKMS_TLS_ENABLED: "false",
	LANDING_PAGE_URL: "http://localhost:3000",
	DASHBOARD_URL: "http://localhost:9090",
});

// ── 4. Initialize services ───────────────────────────────────────────
const { CacheClient } = await import("@/libs/cache");
CacheClient.init("development");

const { DB } = await import("@/libs/db");
await DB.getInstance();

const { seedE2EOrg, seedE2EUser, setupE2EUserPermissions } = await import(
	"../tests/e2e/helpers/real-auth"
);

// ── Types ────────────────────────────────────────────────────────────
import type { E2ESeed, E2EUser } from "../tests/e2e/helpers/real-auth";

// ── CONFIG ───────────────────────────────────────────────────────────
const PORT = process.env.PORT ?? "4000";
const BASE_URL = `http://localhost:${PORT}`;
const NUM_WORKER_POOLS = parseInt(process.env.SIM_WORKERS ?? "200", 10);
const INTER_REQUEST_DELAY_MS = parseInt(process.env.SIM_DELAY_MS ?? "0", 10);
const POOL_REFRESH_INTERVAL_MS = 30_000;
const METRICS_INTERVAL_MS = 5_000;
const MAX_LATENCY_SAMPLES = parseInt(process.env.SIM_MAX_SAMPLES ?? "100000", 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.SIM_TIMEOUT_MS ?? "30000", 10);

// ── Metrics Collector ────────────────────────────────────────────────
const metrics = {
	total: 0,
	success: 0,
	failed: 0,
	latencies: [] as number[],
	perEndpoint: new Map<string, { count: number; errors: number; totalMs: number }>(),
};

function normalizePath(p: string): string {
	return p.replace(
		/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
		"/:id",
	);
}

function recordMetric(method: string, rawPath: string, status: number, ms: number): void {
	metrics.total++;
	if (status >= 200 && status < 400) metrics.success++;
	else metrics.failed++;

	if (metrics.latencies.length >= MAX_LATENCY_SAMPLES) {
		metrics.latencies[Math.floor(Math.random() * MAX_LATENCY_SAMPLES)] = ms;
	} else {
		metrics.latencies.push(ms);
	}

	const key = `${method} ${normalizePath(rawPath)}`;
	let ep = metrics.perEndpoint.get(key);
	if (!ep) {
		ep = { count: 0, errors: 0, totalMs: 0 };
		metrics.perEndpoint.set(key, ep);
	}
	ep.count++;
	if (status < 200 || status >= 400) ep.errors++;
	ep.totalMs += ms;
}

function percentile(arr: number[], p: number): number {
	if (arr.length === 0) return 0;
	const sorted = [...arr].sort((a, b) => a - b);
	const idx = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, idx)];
}

// ── HTTP Helper (no per-request logging) ─────────────────────────────
async function api(
	method: string,
	path: string,
	token: string,
	body?: unknown,
): Promise<{ status: number; data: any; ms: number }> {
	const url = `${BASE_URL}${path}`;
	const start = performance.now();
	try {
		const res = await fetch(url, {
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				"Connection": "keep-alive",
			},
			body: body ? JSON.stringify(body) : undefined,
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			keepalive: true,
		});
		const ms = performance.now() - start;
		let data: any;
		try {
			data = await res.json();
		} catch {
			data = null;
		}
		recordMetric(method, path, res.status, ms);
		if (INTER_REQUEST_DELAY_MS > 0) await Bun.sleep(INTER_REQUEST_DELAY_MS);
		return { status: res.status, data, ms };
	} catch (err) {
		const ms = performance.now() - start;
		recordMetric(method, path, 0, ms);
		return { status: 0, data: null, ms };
	}
}

async function apiFormData(
	path: string,
	token: string,
	formData: FormData,
): Promise<{ status: number; data: any; ms: number }> {
	const url = `${BASE_URL}${path}`;
	const start = performance.now();
	try {
		const res = await fetch(url, {
			method: "POST",
			headers: { Authorization: `Bearer ${token}` },
			body: formData,
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		const ms = performance.now() - start;
		let data: any;
		try {
			data = await res.json();
		} catch {
			data = null;
		}
		recordMetric("POST", path, res.status, ms);
		return { status: res.status, data, ms };
	} catch (err) {
		const ms = performance.now() - start;
		recordMetric("POST", path, 0, ms);
		return { status: 0, data: null, ms };
	}
}

// ── Bootstrap ────────────────────────────────────────────────────────
console.log("[Sim] Bootstrapping org and users...");
let seed: E2ESeed;
const devUsers: E2EUser[] = [];

try {
	seed = await seedE2EOrg();
	console.log(`[Sim] Org created: ${seed.org.slug} (${seed.org.id})`);
	console.log(`[Sim] Master user: ${seed.masterUser.email}`);

	// Seed 3 developer users for multi-user traffic
	const devRoleId = seed.roles.developer.id;
	for (let i = 0; i < 3; i++) {
		const devUser = await seedE2EUser(seed.org.id, devRoleId);
		await setupE2EUserPermissions(devUser.id, seed.org.id, {
			can_view: true,
			can_edit: true,
		});
		devUsers.push(devUser);
		console.log(`[Sim] Dev user ${i + 1}: ${devUser.email}`);
	}
} catch (err) {
	console.error("[Sim] Bootstrap failed:", (err as Error).message);
	process.exit(1);
}

const allTokens = [seed.masterUser.token, ...devUsers.map((u) => u.token)];
const allUserIds = [seed.masterUser.id, ...devUsers.map((u) => u.id)];

function pickRandomToken(): string {
	return allTokens[Math.floor(Math.random() * allTokens.length)];
}

function random<T>(arr: T[]): T | undefined {
	if (arr.length === 0) return undefined;
	return arr[Math.floor(Math.random() * arr.length)];
}

let _uidCounter = 0;
function uid(): string {
	return `${Date.now().toString(36)}_${(++_uidCounter).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── ResourcePoolManager ──────────────────────────────────────────────
interface ResourcePools {
	appIds: string[];
	envTypeIds: string[];
	envTypesWithApp: { id: string; app_id: string }[];
	inviteTokens: string[];
	inviteIds: string[];
	apiKeyIds: string[];
	teamIds: string[];
	webhookIds: string[];
	gpgKeyIds: string[];
	certIds: string[];
	certSerials: string[];
	roleIds: string[];
	nonMasterRoleIds: string[];
	userIds: string[];
	envPitIds: { id: string; env_type_id: string }[];
	secretPitIds: { id: string; env_type_id: string }[];
}

const pools: ResourcePools = {
	appIds: [],
	envTypeIds: [],
	envTypesWithApp: [],
	inviteTokens: [],
	inviteIds: [],
	apiKeyIds: [],
	teamIds: [],
	webhookIds: [],
	gpgKeyIds: [],
	certIds: [],
	certSerials: [],
	roleIds: [],
	nonMasterRoleIds: [],
	userIds: [],
	envPitIds: [],
	secretPitIds: [],
};

async function refreshPools(): Promise<void> {
	const db = await DB.getInstance();
	const orgId = seed.org.id;
	try {
		const [
			apps,
			envTypes,
			invites,
			apiKeys,
			teams,
			webhooks,
			gpgKeys,
			certs,
			roles,
			users,
			envPits,
			secretPits,
		] = await Promise.all([
			db.selectFrom("app").select(["id"]).where("org_id", "=", orgId).execute(),
			db.selectFrom("env_type").select(["id", "app_id"]).where("org_id", "=", orgId).execute(),
			db.selectFrom("invite_user").select(["id", "invite_token"]).where("org_id", "=", orgId).where("is_accepted", "=", false).execute(),
			db.selectFrom("api_keys").select(["id"]).where("org_id", "=", orgId).execute(),
			db.selectFrom("teams").select(["id"]).where("org_id", "=", orgId).execute(),
			db.selectFrom("webhook_store").select(["id"]).where("org_id", "=", orgId).execute(),
			db.selectFrom("gpg_keys").select(["id"]).where("org_id", "=", orgId).execute(),
			db.selectFrom("org_certificates").select(["id", "serial_hex", "status"]).where("org_id", "=", orgId).execute(),
			db.selectFrom("org_role").select(["id", "is_master"]).where("org_id", "=", orgId).execute(),
			db.selectFrom("users").select(["id"]).where("org_id", "=", orgId).execute(),
			db.selectFrom("env_store_pit").select(["id", "env_type_id"]).where("org_id", "=", orgId).orderBy("created_at", "desc").limit(100).execute(),
			db.selectFrom("secret_store_pit").select(["id", "env_type_id"]).where("org_id", "=", orgId).orderBy("created_at", "desc").limit(100).execute(),
		]);

		pools.appIds = apps.map((a) => a.id);
		pools.envTypeIds = envTypes.map((e) => e.id);
		pools.envTypesWithApp = envTypes.map((e) => ({ id: e.id, app_id: e.app_id }));
		pools.inviteTokens = invites.map((i) => i.invite_token);
		pools.inviteIds = invites.map((i) => i.id);
		pools.apiKeyIds = apiKeys.map((a) => a.id);
		pools.teamIds = teams.map((t) => t.id);
		pools.webhookIds = webhooks.map((w) => w.id);
		pools.gpgKeyIds = gpgKeys.map((g) => g.id);
		pools.certIds = certs.filter((c) => c.status === "active").map((c) => c.id);
		pools.certSerials = certs.filter((c) => c.status === "active").map((c) => c.serial_hex);
		pools.roleIds = roles.map((r) => r.id);
		pools.nonMasterRoleIds = roles.filter((r) => !r.is_master).map((r) => r.id);
		pools.userIds = users.map((u) => u.id);
		pools.envPitIds = envPits.map((p) => ({ id: p.id, env_type_id: p.env_type_id }));
		pools.secretPitIds = secretPits.map((p) => ({ id: p.id, env_type_id: p.env_type_id }));
	} catch {
		// pool refresh failure is non-fatal
	}
}

// ── Seed Initial Resources ───────────────────────────────────────────
async function seedInitialResources(): Promise<void> {
	const token = seed.masterUser.token;
	console.log("[Sim] Seeding initial resources...");

	// Create 5 apps
	const appIds: string[] = [];
	for (let i = 0; i < 5; i++) {
		const res = await api("POST", "/api/app", token, {
			name: `sim-app-${uid()}`,
			description: `Simulation app ${i + 1}`,
			enable_secrets: true,
		});
		if (res.data?.id) appIds.push(res.data.id);
	}
	console.log(`[Sim]   Created ${appIds.length} apps`);

	// Create 3 env types per app
	const envTypeIds: string[] = [];
	for (const appId of appIds) {
		for (const et of [
			{ name: "development", color: "#22c55e", is_default: true },
			{ name: "staging", color: "#f59e0b", is_default: false },
			{ name: "production", color: "#ef4444", is_default: false },
		]) {
			const res = await api("POST", "/api/env_type", token, {
				...et,
				is_protected: false,
				app_id: appId,
			});
			if (res.data?.id) envTypeIds.push(res.data.id);
		}
	}
	console.log(`[Sim]   Created ${envTypeIds.length} env types`);

	// Batch env vars + secrets per env type (first 5 env types)
	for (const etId of envTypeIds.slice(0, 5)) {
		const appId = appIds[Math.floor(envTypeIds.indexOf(etId) / 3)];
		await api("PUT", "/api/env/batch", token, {
			app_id: appId,
			env_type_id: etId,
			envs: [
				{ key: "DATABASE_URL", value: "postgresql://localhost:5432/simdb" },
				{ key: "API_KEY", value: `sim-key-${uid()}` },
				{ key: "LOG_LEVEL", value: "debug" },
				{ key: "CACHE_TTL", value: "3600" },
			],
		});
		await api("PUT", "/api/secret/batch", token, {
			app_id: appId,
			env_type_id: etId,
			envs: [
				{ key: "JWT_SECRET", value: `sim-jwt-${uid()}` },
				{ key: "ENCRYPTION_KEY", value: `sim-enc-${uid()}` },
			],
		});
	}
	console.log("[Sim]   Seeded env vars and secrets");

	// Create 3 teams
	for (let i = 0; i < 3; i++) {
		await api("POST", "/api/team", token, {
			name: `sim-team-${uid()}`,
			description: `Simulation team ${i + 1}`,
			color: ["#3357FF", "#FF5733", "#33FF57"][i],
		});
	}
	console.log("[Sim]   Created 3 teams");

	// Create 3 webhooks
	for (let i = 0; i < 3; i++) {
		await api("POST", "/api/webhook", token, {
			name: `sim-webhook-${uid()}`,
			url: `http://localhost:8181/post?sim=${i}`,
			event_types: ["env_created", "env_updated", "env_deleted"],
			webhook_type: "CUSTOM",
			linked_to: "org",
		});
	}
	console.log("[Sim]   Created 3 webhooks");

	// Create 1 API key
	await api("POST", "/api/api_key", token, {
		name: `sim-apikey-${uid()}`,
		description: "Simulation API key",
	});
	console.log("[Sim]   Created 1 API key");

	// Generate 1 GPG key
	await api("PUT", "/api/gpg_key/generate", token, {
		name: `sim-gpg-${uid()}`,
		email: "sim-gpg@test.local",
		algorithm: "ecc-curve25519",
		usage_flags: ["sign"],
		is_default: true,
	});
	console.log("[Sim]   Generated 1 GPG key");

	// Init CA + issue 1 certificate
	await api("POST", "/api/certificate/ca/init", token, {
		org_name: seed.org.name,
		description: "Simulation CA",
	});
	await api("POST", "/api/certificate/issue", token, {
		member_email: seed.masterUser.email,
		role: "admin",
		description: "Simulation cert",
	});
	console.log("[Sim]   Initialized CA and issued 1 cert");

	// Initial pool refresh
	await refreshPools();
	console.log("[Sim] Seeding complete.");
}

// ══════════════════════════════════════════════════════════════════════
// ── 18 Scenario Functions ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

// 1. authWhoami (wt=15, ~2 calls)
async function authWhoami(token: string): Promise<void> {
	await api("GET", "/api/auth/me", token);
	await api("GET", "/api/permission/me", token);
}

// 2. orgOperations (wt=5, ~3 calls)
async function orgOperations(token: string): Promise<void> {
	await api("GET", "/api/org", token);
	await api("PATCH", "/api/org", token, {
		name: `SimOrg-${uid()}`,
	});
	await api("GET", `/api/org/check-slug?slug=sim-slug-${uid()}`, token);
}

// 3. appCrudLifecycle (wt=8, ~6 calls)
async function appCrudLifecycle(token: string): Promise<void> {
	const res = await api("POST", "/api/app", token, {
		name: `sim-crud-${uid()}`,
		description: "CRUD lifecycle app",
		enable_secrets: true,
	});
	const id = res.data?.id;
	await api("GET", "/api/app", token);
	if (id) {
		await api("GET", `/api/app/${id}`, token);
		await api("PATCH", `/api/app/${id}`, token, {
			description: `Updated ${uid()}`,
			metadata: { sim: true },
		});
		await api("DELETE", `/api/app/${id}`, token);
	}
	// Also read an existing app from pool
	const existing = random(pools.appIds);
	if (existing) await api("GET", `/api/app/${existing}`, token);
}

// 4. apiKeyCrudLifecycle (wt=5, ~6 calls)
async function apiKeyCrudLifecycle(token: string): Promise<void> {
	const res = await api("POST", "/api/api_key", token, {
		name: `sim-key-${uid()}`,
		description: "Sim API key",
	});
	const id = res.data?.id;
	await api("GET", "/api/api_key", token);
	if (id) {
		await api("GET", `/api/api_key/${id}`, token);
		await api("PUT", `/api/api_key/${id}`, token, {
			description: `Updated ${uid()}`,
			is_active: true,
		});
		await api("GET", `/api/api_key/${id}/regenerate`, token);
		await api("DELETE", `/api/api_key/${id}`, token);
	}
}

// 5. envTypeCrudLifecycle (wt=5, ~5 calls)
async function envTypeCrudLifecycle(token: string): Promise<void> {
	const appId = random(pools.appIds);
	if (!appId) return;
	const res = await api("POST", "/api/env_type", token, {
		name: `sim-et-${uid()}`,
		color: "#8b5cf6",
		is_default: false,
		is_protected: false,
		app_id: appId,
	});
	const id = res.data?.id;
	await api("GET", "/api/env_type", token);
	if (id) {
		await api("GET", `/api/env_type/${id}`, token);
		await api("PATCH", `/api/env_type/${id}`, token, {
			id,
			name: `sim-et-upd-${uid()}`,
			color: "#ec4899",
		});
		await api("DELETE", `/api/env_type/${id}`, token);
	}
}

// 6. envVarsFullWorkflow (wt=12, ~14 calls)
async function envVarsFullWorkflow(token: string): Promise<void> {
	const appId = random(pools.appIds);
	const et = random(pools.envTypesWithApp);
	if (!appId || !et) return;
	const envTypeId = et.id;
	const appForEt = et.app_id;

	// Batch create
	await api("PUT", "/api/env/batch", token, {
		app_id: appForEt,
		env_type_id: envTypeId,
		envs: [
			{ key: `SIM_VAR_A_${uid()}`, value: "value-a" },
			{ key: `SIM_VAR_B_${uid()}`, value: "value-b" },
			{ key: `SIM_VAR_C_${uid()}`, value: "value-c" },
		],
	});

	// Pull envs
	await api("POST", "/api/env", token, { app_id: appForEt, env_type_id: envTypeId });

	// Create single
	const singleKey = `SIM_SINGLE_${uid()}`;
	await api("PUT", "/api/env/single", token, {
		key: singleKey,
		value: "single-val",
		app_id: appForEt,
		env_type_id: envTypeId,
	});

	// Get single
	await api("POST", `/api/env/i/${singleKey}`, token, {
		app_id: appForEt,
		env_type_id: envTypeId,
	});

	// Update single
	await api("PATCH", `/api/env/i/${singleKey}`, token, {
		value: "updated-val",
		app_id: appForEt,
		env_type_id: envTypeId,
	});

	// History
	await api("POST", "/api/env/history", token, {
		app_id: appForEt,
		env_type_id: envTypeId,
		page: 1,
		per_page: 10,
	});

	// Point-in-time (use pool)
	const pit = random(pools.envPitIds.filter((p) => p.env_type_id === envTypeId));
	if (pit) {
		await api("POST", "/api/env/pit", token, {
			app_id: appForEt,
			env_type_id: envTypeId,
			pit_id: pit.id,
		});
	}

	// Timestamp
	const ts = new Date(Date.now() - 60_000).toISOString();
	await api("POST", "/api/env/timestamp", token, {
		app_id: appForEt,
		env_type_id: envTypeId,
		timestamp: ts,
	});

	// Diff (need 2 pit IDs)
	const pits = pools.envPitIds.filter((p) => p.env_type_id === envTypeId);
	if (pits.length >= 2) {
		await api("POST", "/api/env/diff", token, {
			app_id: appForEt,
			env_type_id: envTypeId,
			from_pit_id: pits[0].id,
			to_pit_id: pits[1].id,
		});
	}

	// Timeline
	await api("POST", `/api/env/timeline/${singleKey}`, token, {
		app_id: appForEt,
		env_type_id: envTypeId,
	});

	// Rollback to timestamp
	await api("POST", "/api/env/rollback/timestamp", token, {
		app_id: appForEt,
		env_type_id: envTypeId,
		timestamp: ts,
		rollback_message: "sim rollback",
	});

	// Rollback single variable to pit
	if (pit) {
		await api("POST", `/api/env/rollback/variable/${singleKey}/pit`, token, {
			app_id: appForEt,
			env_type_id: envTypeId,
			pit_id: pit.id,
			rollback_message: "sim var rollback",
		});
	}

	// Delete single
	await api("DELETE", "/api/env", token, {
		app_id: appForEt,
		env_type_id: envTypeId,
		key: singleKey,
	});
}

// 7. secretsFullWorkflow (wt=10, ~14 calls)
async function secretsFullWorkflow(token: string): Promise<void> {
	const et = random(pools.envTypesWithApp);
	if (!et) return;
	const envTypeId = et.id;
	const appId = et.app_id;

	// Batch create
	await api("PUT", "/api/secret/batch", token, {
		app_id: appId,
		env_type_id: envTypeId,
		envs: [
			{ key: `SIM_SEC_A_${uid()}`, value: "sec-a" },
			{ key: `SIM_SEC_B_${uid()}`, value: "sec-b" },
		],
	});

	// Pull secrets
	await api("POST", "/api/secret", token, { app_id: appId, env_type_id: envTypeId });

	// Create single
	const singleKey = `SIM_SEC_SINGLE_${uid()}`;
	await api("PUT", "/api/secret/single", token, {
		key: singleKey,
		value: "single-sec",
		app_id: appId,
		env_type_id: envTypeId,
	});

	// Get single
	await api("POST", `/api/secret/i/${singleKey}`, token, {
		app_id: appId,
		env_type_id: envTypeId,
	});

	// Update single
	await api("PATCH", `/api/secret/i/${singleKey}`, token, {
		value: "updated-sec",
		app_id: appId,
		env_type_id: envTypeId,
	});

	// Reveal
	await api("POST", "/api/secret/reveal", token, {
		app_id: appId,
		env_type_id: envTypeId,
		keys: [singleKey],
	});

	// History
	await api("POST", "/api/secret/history", token, {
		app_id: appId,
		env_type_id: envTypeId,
		page: "1",
		per_page: "10",
	});

	// Point-in-time
	const pit = random(pools.secretPitIds.filter((p) => p.env_type_id === envTypeId));
	if (pit) {
		await api("POST", "/api/secret/pit", token, {
			app_id: appId,
			env_type_id: envTypeId,
			pit_id: pit.id,
		});
	}

	// Timestamp
	const ts = new Date(Date.now() - 60_000).toISOString();
	await api("POST", "/api/secret/timestamp", token, {
		app_id: appId,
		env_type_id: envTypeId,
		timestamp: ts,
	});

	// Diff
	const pits = pools.secretPitIds.filter((p) => p.env_type_id === envTypeId);
	if (pits.length >= 2) {
		await api("POST", "/api/secret/diff", token, {
			app_id: appId,
			env_type_id: envTypeId,
			from_pit_id: pits[0].id,
			to_pit_id: pits[1].id,
		});
	}

	// Timeline
	await api("POST", `/api/secret/timeline/${singleKey}`, token, {
		app_id: appId,
		env_type_id: envTypeId,
	});

	// Rollback to timestamp
	await api("POST", "/api/secret/rollback/timestamp", token, {
		app_id: appId,
		env_type_id: envTypeId,
		timestamp: ts,
		rollback_message: "sim secret rollback",
	});

	// Delete single
	await api("DELETE", "/api/secret", token, {
		app_id: appId,
		env_type_id: envTypeId,
		key: singleKey,
	});
}

// 8. onboardingLifecycle (wt=4, ~5 calls)
async function onboardingLifecycle(token: string): Promise<void> {
	const roleId = random(pools.nonMasterRoleIds) ?? seed.roles.viewer.id;
	await api("POST", "/api/onboarding/user", token, {
		email: `sim-invite-${uid()}@test.local`,
		role_id: roleId,
	});
	await api("GET", "/api/onboarding/user", token);

	// Lookup invite_token from pool for get/patch/delete
	const invToken = random(pools.inviteTokens);
	if (invToken) {
		await api("GET", `/api/onboarding/user/${invToken}`, token);
		await api("PATCH", `/api/onboarding/user/${invToken}`, token, {
			role_id: roleId,
		});
	}
	const invId = random(pools.inviteIds);
	if (invId) {
		await api("DELETE", `/api/onboarding/user/${invId}`, token);
	}
}

// 9. roleCrudLifecycle (wt=5, ~6 calls)
async function roleCrudLifecycle(token: string): Promise<void> {
	const res = await api("POST", "/api/role", token, {
		name: `sim-role-${uid()}`,
		can_edit: true,
		can_view: true,
		have_api_access: false,
		have_billing_options: false,
		have_webhook_access: false,
		is_admin: false,
		color: "#6366f1",
	});
	const id = res.data?.id;
	await api("GET", "/api/role", token);
	await api("GET", "/api/role/stats", token);
	if (id) {
		await api("GET", `/api/role/${id}`, token);
		await api("PATCH", `/api/role/${id}`, token, {
			name: `sim-role-upd-${uid()}`,
			color: "#f43f5e",
		});
		await api("DELETE", `/api/role/${id}`, token);
	}
}

// 10. userOperations (wt=5, ~4 calls)
async function userOperations(token: string): Promise<void> {
	await api("GET", "/api/user", token);
	const userId = random(allUserIds);
	if (userId) {
		await api("GET", `/api/user/${userId}`, token);
		await api("PATCH", `/api/user/${userId}`, token, {
			full_name: `SimUser ${uid()}`,
		});
	}
	// Update user role (using a non-master role)
	const roleId = random(pools.nonMasterRoleIds);
	const targetUser = random(devUsers.map((u) => u.id));
	if (roleId && targetUser) {
		await api("PATCH", `/api/user/role/${targetUser}`, token, {
			role_id: roleId,
		});
	}
}

// 11. teamCrudLifecycle (wt=5, ~7 calls)
async function teamCrudLifecycle(token: string): Promise<void> {
	const res = await api("POST", "/api/team", token, {
		name: `sim-team-${uid()}`,
		description: "Sim team lifecycle",
		color: "#0ea5e9",
	});
	const id = res.data?.id;
	await api("GET", "/api/team", token);
	if (id) {
		await api("GET", `/api/team/${id}`, token);
		await api("PATCH", `/api/team/${id}`, token, {
			name: `sim-team-upd-${uid()}`,
		});
		// Add a dev user as member
		const devId = random(devUsers.map((u) => u.id));
		if (devId) {
			await api("POST", `/api/team/${id}/members`, token, { user_id: devId });
			await api("DELETE", `/api/team/${id}/members/${devId}`, token);
		}
		await api("DELETE", `/api/team/${id}`, token);
	}
}

// 12. permissionOperations (wt=5, ~5 calls)
async function permissionOperations(token: string): Promise<void> {
	await api("GET", "/api/permission/me", token);
	const appId = random(pools.appIds);
	const userId = random(devUsers.map((u) => u.id));
	if (appId && userId) {
		await api("POST", `/api/permission/app/${appId}/grant`, token, {
			subject_id: userId,
			subject_type: "user",
			relation: "viewer",
		});
		await api("POST", `/api/permission/app/${appId}/revoke`, token, {
			subject_id: userId,
			subject_type: "user",
			relation: "viewer",
		});
	}
	const etId = random(pools.envTypeIds);
	if (etId && userId) {
		await api("POST", `/api/permission/env_type/${etId}/grant`, token, {
			subject_id: userId,
			subject_type: "user",
			relation: "editor",
		});
		await api("POST", `/api/permission/env_type/${etId}/revoke`, token, {
			subject_id: userId,
			subject_type: "user",
			relation: "editor",
		});
	}
}

// 13. webhookCrudLifecycle (wt=5, ~5 calls)
async function webhookCrudLifecycle(token: string): Promise<void> {
	const res = await api("POST", "/api/webhook", token, {
		name: `sim-wh-${uid()}`,
		url: `http://localhost:8181/post?sim=${uid()}`,
		event_types: ["env_created", "env_updated"],
		webhook_type: "CUSTOM",
		linked_to: "org",
	});
	const id = res.data?.id;
	await api("GET", "/api/webhook", token);
	if (id) {
		await api("GET", `/api/webhook/${id}`, token);
		await api("PUT", `/api/webhook/${id}`, token, {
			name: `sim-wh-upd-${uid()}`,
			url: `http://localhost:8181/post?sim=${uid()}`,
			event_types: ["env_created"],
			is_active: true,
			webhook_type: "CUSTOM",
			linked_to: "org",
		});
		await api("DELETE", `/api/webhook/${id}`, token);
	}
}

// 14. gpgKeyFullWorkflow (wt=5, ~9 calls)
async function gpgKeyFullWorkflow(token: string): Promise<void> {
	const res = await api("PUT", "/api/gpg_key/generate", token, {
		name: `sim-gpg-${uid()}`,
		email: `sim-gpg-${uid()}@test.local`,
		algorithm: "ecc-curve25519",
		usage_flags: ["sign"],
		is_default: false,
	});
	const id = res.data?.id;
	await api("GET", "/api/gpg_key", token);
	if (id) {
		await api("GET", `/api/gpg_key/${id}`, token);
		await api("GET", `/api/gpg_key/${id}/export`, token);

		// Sign data
		const dataB64 = Buffer.from(`sim-data-${uid()}`).toString("base64");
		const signRes = await api("POST", "/api/gpg_key/sign", token, {
			gpg_key_id: id,
			data: dataB64,
			mode: "binary",
			detached: true,
		});

		// Verify signature
		if (signRes.data?.signature) {
			await api("POST", "/api/gpg_key/verify", token, {
				data: dataB64,
				signature: signRes.data.signature,
				gpg_key_id: id,
			});
		}

		// Update trust level
		await api("PATCH", `/api/gpg_key/${id}/trust`, token, {
			trust_level: "full",
		});

		// Revoke
		await api("POST", `/api/gpg_key/${id}/revoke`, token, {
			reason: "Simulation cleanup",
		});

		// Delete
		await api("DELETE", `/api/gpg_key/${id}`, token);
	}
}

// 15. certificateFullWorkflow (wt=4, ~8 calls)
async function certificateFullWorkflow(token: string): Promise<void> {
	// Check CA status
	await api("GET", "/api/certificate/ca", token);

	// Get root CA
	await api("GET", "/api/certificate/root-ca", token);

	// Issue cert
	const issueRes = await api("POST", "/api/certificate/issue", token, {
		member_email: `sim-cert-${uid()}@test.local`,
		role: "developer",
		description: "Sim cert",
	});
	const serialHex = issueRes.data?.serial_hex;

	// List certs
	await api("GET", "/api/certificate", token);

	// Get cert by pool
	const certId = random(pools.certIds);
	if (certId) {
		await api("GET", `/api/certificate/${certId}`, token);
	}

	// OCSP check
	const serial = serialHex ?? random(pools.certSerials);
	if (serial) {
		await api("GET", `/api/certificate/${serial}/ocsp`, token);
	}

	// Revoke the newly issued cert
	if (serialHex) {
		await api("POST", `/api/certificate/${serialHex}/revoke`, token, {
			reason: 0,
		});
	}

	// CRL
	await api("GET", "/api/certificate/crl", token);
}

// 16. auditLogRead (wt=2, ~2 calls)
async function auditLogRead(token: string): Promise<void> {
	await api("GET", "/api/audit_log", token);
	await api("GET", "/api/audit_log?page=2&per_page=10", token);
}

// 17. fileUpload (wt=2, ~2 calls)
async function fileUpload(token: string): Promise<void> {
	// Upload a small text file via multipart form data
	const content = `sim-file-${uid()}-${Date.now()}\nThis is a simulated file upload.`;
	const blob = new Blob([content], { type: "text/plain" });
	const formData = new FormData();
	formData.append("file", blob, `sim-upload-${uid()}.txt`);
	await apiFormData("/api/upload/file", token, formData);

	// Upload a small "json" file
	const jsonContent = JSON.stringify({ sim: true, ts: Date.now(), id: uid() });
	const jsonBlob = new Blob([jsonContent], { type: "application/json" });
	const formData2 = new FormData();
	formData2.append("file", jsonBlob, `sim-data-${uid()}.json`);
	await apiFormData("/api/upload/file", token, formData2);
}

// 18. healthAndDocs (wt=3, ~3 calls)
async function healthAndDocs(token: string): Promise<void> {
	await api("GET", "/health", token);
	await api("GET", "/version", token);
	await api("GET", "/openapi", token);
}

// ── Weighted Scenario Selection ──────────────────────────────────────
interface Scenario {
	name: string;
	weight: number;
	fn: (token: string) => Promise<void>;
}

const scenarios: Scenario[] = [
	{ name: "authWhoami", weight: 15, fn: authWhoami },
	{ name: "orgOperations", weight: 5, fn: orgOperations },
	{ name: "appCrudLifecycle", weight: 8, fn: appCrudLifecycle },
	{ name: "apiKeyCrudLifecycle", weight: 5, fn: apiKeyCrudLifecycle },
	{ name: "envTypeCrudLifecycle", weight: 5, fn: envTypeCrudLifecycle },
	{ name: "envVarsFullWorkflow", weight: 12, fn: envVarsFullWorkflow },
	{ name: "secretsFullWorkflow", weight: 10, fn: secretsFullWorkflow },
	{ name: "onboardingLifecycle", weight: 4, fn: onboardingLifecycle },
	{ name: "roleCrudLifecycle", weight: 5, fn: roleCrudLifecycle },
	{ name: "userOperations", weight: 5, fn: userOperations },
	{ name: "teamCrudLifecycle", weight: 5, fn: teamCrudLifecycle },
	{ name: "permissionOperations", weight: 5, fn: permissionOperations },
	{ name: "webhookCrudLifecycle", weight: 5, fn: webhookCrudLifecycle },
	{ name: "gpgKeyFullWorkflow", weight: 5, fn: gpgKeyFullWorkflow },
	{ name: "certificateFullWorkflow", weight: 4, fn: certificateFullWorkflow },
	{ name: "auditLogRead", weight: 2, fn: auditLogRead },
	{ name: "fileUpload", weight: 2, fn: fileUpload },
	{ name: "healthAndDocs", weight: 3, fn: healthAndDocs },
];

const cumulativeWeights: number[] = [];
let cumSum = 0;
for (const s of scenarios) {
	cumSum += s.weight;
	cumulativeWeights.push(cumSum);
}

function selectWeightedRandom(): Scenario {
	const r = Math.random() * cumSum;
	for (let i = 0; i < cumulativeWeights.length; i++) {
		if (r < cumulativeWeights[i]) return scenarios[i];
	}
	return scenarios[scenarios.length - 1];
}

// ── Worker Pool ──────────────────────────────────────────────────────
let shuttingDown = false;

async function worker(_workerId: number): Promise<void> {
	while (!shuttingDown) {
		const scenario = selectWeightedRandom();
		const token = pickRandomToken();
		try {
			await scenario.fn(token);
		} catch {
			// scenario errors are non-fatal; metrics already recorded
		}
	}
}

// ── Metrics Reporter ─────────────────────────────────────────────────
let lastReportTotal = 0;
let lastReportTime = performance.now();

function reportMetrics(): void {
	const now = performance.now();
	const elapsed = (now - lastReportTime) / 1000;
	const reqs = metrics.total - lastReportTotal;
	const rps = elapsed > 0 ? Math.round(reqs / elapsed) : 0;
	lastReportTotal = metrics.total;
	lastReportTime = now;

	const p50 = percentile(metrics.latencies, 50).toFixed(1);
	const p95 = percentile(metrics.latencies, 95).toFixed(1);
	const p99 = percentile(metrics.latencies, 99).toFixed(1);

	// Top 5 endpoints by count
	const sorted = [...metrics.perEndpoint.entries()]
		.sort((a, b) => b[1].count - a[1].count)
		.slice(0, 5);
	const topEndpoints = sorted
		.map(([ep, v]) => `    ${ep}: ${v.count} reqs (${v.errors} err, avg ${(v.totalMs / v.count).toFixed(1)}ms)`)
		.join("\n");

	console.log(
		`\n[Metrics] ${new Date().toISOString()}\n` +
		`  Total: ${metrics.total} | Success: ${metrics.success} | Failed: ${metrics.failed}\n` +
		`  RPS: ${rps} | p50: ${p50}ms | p95: ${p95}ms | p99: ${p99}ms\n` +
		`  Top endpoints:\n${topEndpoints}`,
	);
}

// ── Lifecycle ────────────────────────────────────────────────────────
console.log(`[Sim] Starting high-throughput simulation`);
console.log(`[Sim] Target: ${BASE_URL} | Workers: ${NUM_WORKER_POOLS} | Delay: ${INTER_REQUEST_DELAY_MS}ms | Timeout: ${REQUEST_TIMEOUT_MS}ms | Max samples: ${MAX_LATENCY_SAMPLES}`);

// Seed resources before starting workers
await seedInitialResources();

// Start pool refresh interval
const poolRefreshInterval = setInterval(async () => {
	try {
		await refreshPools();
	} catch {}
}, POOL_REFRESH_INTERVAL_MS);

// Start metrics reporter
const metricsInterval = setInterval(reportMetrics, METRICS_INTERVAL_MS);

// Launch workers
const workerPromises = Array.from({ length: NUM_WORKER_POOLS }, (_, i) => worker(i));
console.log(`[Sim] ${NUM_WORKER_POOLS} workers launched. Press Ctrl+C to stop.`);

// Graceful shutdown
function shutdown(): void {
	if (shuttingDown) return;
	shuttingDown = true;
	console.log("\n[Sim] Shutting down...");
	clearInterval(poolRefreshInterval);
	clearInterval(metricsInterval);
	reportMetrics(); // final report
	// Workers will exit their loops since shuttingDown = true
	Promise.allSettled(workerPromises).then(() => {
		console.log("[Sim] All workers stopped. Goodbye.");
		process.exit(0);
	});
	// Force exit after 2s if workers hang
	setTimeout(() => process.exit(0), 2000);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep process alive
await Promise.allSettled(workerPromises);

// ── Helpers ──────────────────────────────────────────────────────────

function findProjectRoot(): string {
	let dir = path.resolve(import.meta.dir, "..");
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
	return path.resolve(import.meta.dir, "..");
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
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1).replace(/\\"/g, '"');
		}
		if (key) process.env[key] = value;
	}
}

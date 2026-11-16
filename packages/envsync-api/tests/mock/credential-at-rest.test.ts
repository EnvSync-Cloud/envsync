import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { isCredentialEnvelope } from "envsync-enterprise/services/credential-envelope.ts";
import { CmkCredentialService } from "envsync-enterprise/services/cmk-credential.service.ts";
import { PostgresEngine } from "envsync-enterprise/services/dynamic-secret-engines/postgres.ts";
import { DynamicSecretService } from "envsync-enterprise/services/dynamic_secret.service.ts";
import { EnterpriseIntegrationService } from "envsync-enterprise/services/enterprise-integration.service.ts";
import { LogForwardingService } from "envsync-enterprise/services/log-forwarding.service.ts";

import { JsonValue } from "@/libs/db";

import { cleanupDB, getDB, seedApp, seedEnvType, seedOrg, type SeedOrgResult } from "../helpers/db";

const INTEGRATION_TOKEN = "ghp_dev150_integration_token_plaintext";
const LEGACY_INTEGRATION_TOKEN = "ghp_dev150_legacy_integration_token";
const ENGINE_PASSWORD = "dev150-superuser-password-plaintext";
const LEGACY_ENGINE_PASSWORD = "dev150-legacy-superuser-password";
const LEASE_PASSWORD = "dev150-lease-password-plaintext";
const LEGACY_LEASE_PASSWORD = "dev150-legacy-lease-password";
const LOG_API_KEY = "dd-dev150-api-key-plaintext";
const LEGACY_LOG_API_KEY = "dd-dev150-legacy-api-key-plaintext";

let seed: SeedOrgResult;
const originalGenerate = PostgresEngine.prototype.generateCredentials;
const originalRevoke = PostgresEngine.prototype.revokeCredentials;
let seenGenerate: Record<string, unknown> | null = null;
let seenRevoke: { config: Record<string, unknown>; credential: Record<string, unknown> } | null = null;

beforeEach(async () => {
	await cleanupDB();
	seed = await seedOrg();
	seenGenerate = null;
	seenRevoke = null;
});

afterEach(() => {
	PostgresEngine.prototype.generateCredentials = originalGenerate;
	PostgresEngine.prototype.revokeCredentials = originalRevoke;
});

function installEngineSpy() {
	PostgresEngine.prototype.generateCredentials = async function (config) {
		seenGenerate = config;
		return {
			username: "envsync_lease_user",
			password: LEASE_PASSWORD,
			host: "db.internal",
			port: 5432,
			database: "app",
			connection_string: `postgresql://envsync_lease_user:${LEASE_PASSWORD}@db.internal:5432/app`,
		};
	};
	PostgresEngine.prototype.revokeCredentials = async function (config, credential) {
		seenRevoke = { config, credential: credential as Record<string, unknown> };
	};
}

function engineConfig(password: string) {
	return {
		host: "db.internal",
		port: 5432,
		database: "app",
		superuser: { username: "dynroot", password },
		creation_statements: ["SELECT 1"],
		default_ttl_seconds: 3600,
		max_ttl_seconds: 86400,
	};
}

describe("integration org secrets at rest", () => {
	test("persists ciphertext and decrypts only when the sync reader loads the token", async () => {
		const created = await EnterpriseIntegrationService.createOrgSecret({
			org_id: seed.org.id,
			key: "GITHUB_TOKEN",
			value: INTEGRATION_TOKEN,
			description: "github",
		});
		expect(created).not.toHaveProperty("value");

		const db = await getDB();
		const stored = await db.selectFrom("org_secret").selectAll().where("id", "=", created.id).executeTakeFirstOrThrow();
		expect(stored.value).not.toContain(INTEGRATION_TOKEN);
		expect(isCredentialEnvelope(JSON.parse(stored.value))).toBe(true);

		const listed = await EnterpriseIntegrationService.listOrgSecrets(seed.org.id);
		expect(JSON.stringify(listed)).not.toContain(INTEGRATION_TOKEN);
		expect(listed[0]).not.toHaveProperty("value");

		await expect(EnterpriseIntegrationService.readOrgSecretValue(seed.org.id, "GITHUB_TOKEN")).resolves.toBe(INTEGRATION_TOKEN);
	});

	test("upgrades a legacy plaintext org secret on read without returning it from list", async () => {
		const db = await getDB();
		const id = crypto.randomUUID();
		await db.insertInto("org_secret").values({
			id,
			org_id: seed.org.id,
			key: "LEGACY_TOKEN",
			value: LEGACY_INTEGRATION_TOKEN,
			description: null,
			metadata: {},
			created_at: new Date(),
			updated_at: new Date(),
		}).execute();

		await expect(EnterpriseIntegrationService.readOrgSecretValue(seed.org.id, "LEGACY_TOKEN")).resolves.toBe(LEGACY_INTEGRATION_TOKEN);
		const stored = await db.selectFrom("org_secret").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
		expect(stored.value).not.toContain(LEGACY_INTEGRATION_TOKEN);
		expect(isCredentialEnvelope(JSON.parse(stored.value))).toBe(true);

		const listed = await EnterpriseIntegrationService.listOrgSecrets(seed.org.id);
		expect(JSON.stringify(listed)).not.toContain(LEGACY_INTEGRATION_TOKEN);
	});

	test("does not rewrap purpose=kms credentials", async () => {
		const cred = await CmkCredentialService.create({
			org_id: seed.org.id,
			key: "aws-prod",
			value: "kms-credential-plaintext",
		});
		await EnterpriseIntegrationService.listOrgSecrets(seed.org.id);
		const db = await getDB();
		const stored = await db.selectFrom("org_secret").selectAll().where("id", "=", cred.id).executeTakeFirstOrThrow();
		expect(stored.value).not.toContain("kms-credential-plaintext");
		expect(JSON.parse(stored.value).v).toBe(1);
		await expect(CmkCredentialService.decryptValue(seed.org.id, cred.id)).resolves.toBe("kms-credential-plaintext");
	});
});

describe("dynamic secret credentials at rest", () => {
	beforeEach(() => {
		installEngineSpy();
	});

	test("seals engine and lease credentials and still passes plaintext to the engine", async () => {
		const app = await seedApp(seed.org.id);
		const envType = await seedEnvType(seed.org.id, app.id);
		const created = await DynamicSecretService.createEngine({
			org_id: seed.org.id,
			engine_type: "postgres",
			name: "primary",
			config: engineConfig(ENGINE_PASSWORD),
		});
		expect(JSON.stringify(created.config)).not.toContain(ENGINE_PASSWORD);

		const db = await getDB();
		const storedEngine = await db.selectFrom("dynamic_secret_engines").selectAll().where("id", "=", created.id).executeTakeFirstOrThrow();
		expect(JSON.stringify(storedEngine.config)).not.toContain(ENGINE_PASSWORD);
		const superuser = (storedEngine.config as { superuser?: { password?: unknown } }).superuser;
		expect(isCredentialEnvelope(superuser?.password)).toBe(true);

		const listed = await DynamicSecretService.getEngine(created.id, seed.org.id);
		expect(JSON.stringify(listed.config)).not.toContain(ENGINE_PASSWORD);

		const lease = await DynamicSecretService.createLease({
			engine_id: created.id,
			app_id: app.id,
			env_type_id: envType.id,
			variable_key: "DATABASE_URL",
			org_id: seed.org.id,
		});
		expect(seenGenerate).toMatchObject({ superuser: { username: "dynroot", password: ENGINE_PASSWORD } });
		expect(JSON.stringify(lease.credential_data)).not.toContain(LEASE_PASSWORD);

		const storedLease = await db.selectFrom("dynamic_secret_leases").selectAll().where("id", "=", lease.id).executeTakeFirstOrThrow();
		expect(JSON.stringify(storedLease.credential_data)).not.toContain(LEASE_PASSWORD);
		expect(JSON.stringify(storedLease.credential_data)).not.toContain("envsync_lease_user:dev150");
		expect(isCredentialEnvelope(storedLease.credential_data)).toBe(true);

		const fetched = await DynamicSecretService.getLease(lease.id, seed.org.id);
		expect(JSON.stringify(fetched.credential_data)).not.toContain(LEASE_PASSWORD);

		await DynamicSecretService.revokeLease(lease.id, seed.org.id);
		expect(seenRevoke?.config).toMatchObject({ superuser: { password: ENGINE_PASSWORD } });
		expect(seenRevoke?.credential).toMatchObject({
			username: "envsync_lease_user",
			password: LEASE_PASSWORD,
		});
	});

	test("upgrades legacy plaintext engine and lease credentials on use", async () => {
		const app = await seedApp(seed.org.id);
		const envType = await seedEnvType(seed.org.id, app.id);
		const db = await getDB();
		const engineId = crypto.randomUUID();
		await db.insertInto("dynamic_secret_engines").values({
			id: engineId,
			org_id: seed.org.id,
			engine_type: "postgres",
			name: "legacy-engine",
			config: engineConfig(LEGACY_ENGINE_PASSWORD),
			enabled: true,
			created_at: new Date(),
			updated_at: new Date(),
		}).execute();

		const leaseId = crypto.randomUUID();
		await db.insertInto("dynamic_secret_leases").values({
			id: leaseId,
			engine_id: engineId,
			app_id: app.id,
			env_type_id: envType.id,
			variable_key: "DATABASE_URL",
			credential_data: {
				username: "legacy_user",
				password: LEGACY_LEASE_PASSWORD,
				connection_string: `postgresql://legacy_user:${LEGACY_LEASE_PASSWORD}@db.internal:5432/app`,
			},
			expires_at: new Date(Date.now() + 60_000),
			created_at: new Date(),
			updated_at: new Date(),
		}).execute();

		await DynamicSecretService.revokeLease(leaseId, seed.org.id);
		expect(seenRevoke?.config).toMatchObject({ superuser: { password: LEGACY_ENGINE_PASSWORD } });
		expect(seenRevoke?.credential).toMatchObject({ password: LEGACY_LEASE_PASSWORD });

		const storedEngine = await db.selectFrom("dynamic_secret_engines").selectAll().where("id", "=", engineId).executeTakeFirstOrThrow();
		expect(JSON.stringify(storedEngine.config)).not.toContain(LEGACY_ENGINE_PASSWORD);
		const storedLease = await db.selectFrom("dynamic_secret_leases").selectAll().where("id", "=", leaseId).executeTakeFirstOrThrow();
		expect(JSON.stringify(storedLease.credential_data)).not.toContain(LEGACY_LEASE_PASSWORD);
		expect(isCredentialEnvelope(storedLease.credential_data)).toBe(true);

		const viewed = await DynamicSecretService.getEngine(engineId, seed.org.id);
		expect(JSON.stringify(viewed.config)).not.toContain(LEGACY_ENGINE_PASSWORD);
	});
});

describe("log forwarding credentials at rest", () => {
	test("persists ciphertext and decrypts only when forwarding", async () => {
		const seenKeys: string[] = [];
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (_url, init) => {
			const headers = init?.headers as Record<string, string> | undefined;
			if (headers?.["DD-API-KEY"]) seenKeys.push(headers["DD-API-KEY"]);
			return new Response("", { status: 202 });
		}) as typeof fetch;

		try {
			const id = await LogForwardingService.createConfig({
				org_id: seed.org.id,
				name: "Datadog",
				provider_type: "datadog",
				config: { api_key: LOG_API_KEY, site: "datadoghq.com", service: "envsync" },
			});
			const db = await getDB();
			const stored = await db.selectFrom("log_forwarding_configs").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
			expect(JSON.stringify(stored.config)).not.toContain(LOG_API_KEY);
			expect(isCredentialEnvelope((stored.config as { api_key?: unknown }).api_key)).toBe(true);

			const viewed = await LogForwardingService.getConfigById(id);
			expect(JSON.stringify(viewed.config)).not.toContain(LOG_API_KEY);
			expect(viewed.config).not.toHaveProperty("api_key");
			expect(viewed.config).toMatchObject({ site: "datadoghq.com", service: "envsync" });

			await LogForwardingService.forwardAuditLog({
				action: "get_audit_logs",
				org_id: seed.org.id,
				user_id: "user-1",
				details: { ok: true },
				message: "audit",
			});
			expect(seenKeys).toEqual([LOG_API_KEY]);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("upgrades a legacy plaintext log forwarding credential on forward", async () => {
		const seenKeys: string[] = [];
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (_url, init) => {
			const headers = init?.headers as Record<string, string> | undefined;
			if (headers?.["DD-API-KEY"]) seenKeys.push(headers["DD-API-KEY"]);
			return new Response("", { status: 202 });
		}) as typeof fetch;

		try {
			const db = await getDB();
			const id = crypto.randomUUID();
			await db.insertInto("log_forwarding_configs").values({
				id,
				org_id: seed.org.id,
				name: "Legacy Datadog",
				provider_type: "datadog",
				config: new JsonValue({ api_key: LEGACY_LOG_API_KEY, site: "datadoghq.com" }),
				enabled: true,
				created_at: new Date(),
				updated_at: new Date(),
			}).execute();

			await LogForwardingService.forwardAuditLog({
				action: "get_audit_logs",
				org_id: seed.org.id,
				user_id: "user-1",
				details: {},
				message: "audit",
			});
			expect(seenKeys).toEqual([LEGACY_LOG_API_KEY]);

			const stored = await db.selectFrom("log_forwarding_configs").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
			expect(JSON.stringify(stored.config)).not.toContain(LEGACY_LOG_API_KEY);
			expect(isCredentialEnvelope((stored.config as { api_key?: unknown }).api_key)).toBe(true);

			const viewed = await LogForwardingService.getConfigsByOrgId(seed.org.id);
			expect(JSON.stringify(viewed)).not.toContain(LEGACY_LOG_API_KEY);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

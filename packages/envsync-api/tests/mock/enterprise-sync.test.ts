import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { cleanupDB, getDB, seedApp, seedEnvType, seedOrg, type SeedOrgResult } from "../helpers/db";
import { MockFGAClient, resetFGA, setupUserOrgTuples } from "../helpers/fga";
import { MockKMSClient, resetVaultStore, setMockVaultSessionFactory } from "../helpers/kms";
import { generateKeyPair } from "@/helpers/key-store";
import { SecretService } from "@/services/secret.service";
import { EnterpriseIntegrationService, EnterpriseProviderSyncService } from "envsync-enterprise";

const SECRET_KEY = "API_TOKEN";
const SECRET_VALUE = "super-secret-token";
const ENV_KEY = "DATABASE_URL";
const ENV_VALUE = "postgres://envsync.local/app";
const POISONED_CIPHERTEXT = "RSA:not-valid-ciphertext-value";

let seed: SeedOrgResult;
let appId: string;
let envTypeId: string;

type SyncItem = { key: string; value: string; kind: "env" | "secret" };
const recordedSyncItems: SyncItem[][] = [];

const originalProviderSync = EnterpriseProviderSyncService.sync;
const originalVaultRead = MockKMSClient.vaultRead;

beforeEach(async () => {
	await cleanupDB();
	resetFGA();
	resetVaultStore();
	recordedSyncItems.length = 0;
	MockKMSClient.vaultRead = originalVaultRead;

	seed = await seedOrg();
	setupUserOrgTuples(seed.masterUser.id, seed.org.id, {
		is_master: true,
		is_admin: true,
		can_view: true,
		can_edit: true,
		have_api_access: true,
		have_billing_options: true,
		have_webhook_access: true,
	});

	const keyPair = generateKeyPair();
	const app = await seedApp(seed.org.id, {
		enableSecrets: true,
		isManagedSecret: true,
		publicKey: keyPair.publicKey,
		privateKey: keyPair.privateKey,
	});
	appId = app.id;

	const envType = await seedEnvType(seed.org.id, appId);
	envTypeId = envType.id;

	await MockFGAClient.writeTuples([
		{ user: `app:${appId}`, relation: "app", object: `env_type:${envTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `env_type:${envTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `app:${appId}` },
	]);

	EnterpriseProviderSyncService.sync = async (context) => {
		recordedSyncItems.push(context.items.map(item => ({
			key: item.key,
			value: item.value,
			kind: item.kind,
		})));
		return {
			written_count: context.items.length,
			target: {
				target_identifier: context.mapping.target_identifier,
				branch_ref: context.mapping.branch_ref,
				item_keys: context.items.map(item => item.key),
			},
		};
	};
});

afterEach(() => {
	EnterpriseProviderSyncService.sync = originalProviderSync;
	MockKMSClient.vaultRead = originalVaultRead;
	setMockVaultSessionFactory(null);
});

async function provisionGithubSync() {
	await testRequest("/api/env/single", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			key: ENV_KEY,
			value: ENV_VALUE,
			app_id: appId,
			env_type_id: envTypeId,
		},
	});
	const secretResponse = await testRequest("/api/secret/single", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			key: SECRET_KEY,
			value: SECRET_VALUE,
			app_id: appId,
			env_type_id: envTypeId,
		},
	});
	expect(secretResponse.status).toBe(201);

	const connection = await EnterpriseIntegrationService.createProviderConnection({
		org_id: seed.org.id,
		provider_type: "github",
		name: "GitHub Production",
		auth_config: {
			owner: "envsync-cloud",
		},
		metadata: {
			team: "platform",
		},
	});

	const binding = await EnterpriseIntegrationService.createBinding({
		org_id: seed.org.id,
		app_id: appId,
		provider_connection_id: connection.id,
		provider_type: "github",
		is_enabled: true,
		metadata: {
			name_prefix: "APP",
		},
	});

	await EnterpriseIntegrationService.createMapping({
		org_id: seed.org.id,
		app_id: appId,
		env_type_id: envTypeId,
		integration_binding_id: binding.id,
		target_identifier: "envsync-cloud/envsync",
		branch_ref: "main",
		metadata: {
			environment: "production",
		},
	});
}

function syncRunInput() {
	return {
		org_id: seed.org.id,
		app_id: appId,
		provider_type: "github" as const,
		actor_user_id: seed.masterUser.id,
		metadata: {
			source: "test-suite",
		},
	};
}

async function storedSecretCiphertext() {
	const stored = await SecretService.getAllSecret({
		app_id: appId,
		org_id: seed.org.id,
		env_type_id: envTypeId,
		user_id: seed.masterUser.id,
	});
	const secret = stored.find(entry => entry.key === SECRET_KEY);
	expect(secret?.value).toBeString();
	expect(secret?.value).not.toBe(SECRET_VALUE);
	return secret!.value;
}

function expectProviderNotCalledWithCiphertext(ciphertext: string) {
	expect(recordedSyncItems).toHaveLength(0);
	for (const call of recordedSyncItems) {
		for (const item of call) {
			expect(item.value).not.toBe(ciphertext);
			expect(item.value).not.toBe(SECRET_VALUE);
		}
	}
}

describe("EnterpriseIntegrationService.createManualSyncRun", () => {
	test("decrypts vault secrets before provider sync and keeps them out of audit events", async () => {
		await provisionGithubSync();
		const ciphertext = await storedSecretCiphertext();

		const run = await EnterpriseIntegrationService.createManualSyncRun(syncRunInput());

		expect(run.status).toBe("succeeded");
		expect(run.error_message).toBeNull();
		expect(run.metadata).toMatchObject({
			source: "test-suite",
			summary: {
				binding_count: 1,
				mapping_count: 1,
				env_type_count: 1,
				env_count: 1,
				secret_count: 1,
				target_count: 1,
				provider_type: "github",
			},
		});
		expect(recordedSyncItems).toHaveLength(1);
		expect(recordedSyncItems[0]).toEqual(expect.arrayContaining([
			{ key: ENV_KEY, value: ENV_VALUE, kind: "env" },
			{ key: SECRET_KEY, value: SECRET_VALUE, kind: "secret" },
		]));
		expect(recordedSyncItems[0]?.find(item => item.kind === "secret")?.value).not.toBe(ciphertext);

		const db = await getDB();
		const events = await db
			.selectFrom("sync_audit_event")
			.selectAll()
			.where("sync_run_id", "=", run.id)
			.orderBy("created_at", "asc")
			.execute();

		expect(events.length).toBeGreaterThanOrEqual(6);
		expect(events.map(event => event.action)).toEqual(
			expect.arrayContaining([
				"manual_sync_requested",
				"sync_run_started",
				"binding_resolved",
				"mapping_validated",
				"payload_compiled",
				"provider_target_planned",
				"provider_sync_applied",
				"sync_run_completed",
			]),
		);
		const serialized = JSON.stringify({ run, events });
		expect(serialized).not.toContain(SECRET_VALUE);
		expect(serialized).not.toContain(ciphertext);
	});

	test("does not call the provider with ciphertext when secret decrypt fails", async () => {
		await provisionGithubSync();
		const ciphertext = await storedSecretCiphertext();
		MockKMSClient.vaultRead = async (req, sessionToken) => {
			const result = await originalVaultRead(req, sessionToken);
			if (req.entryType === "secret") {
				return { ...result, encryptedValue: Buffer.from(POISONED_CIPHERTEXT, "utf-8") };
			}
			return result;
		};

		const run = await EnterpriseIntegrationService.createManualSyncRun(syncRunInput());

		expect(run.status).toBe("failed");
		expect(run.error_message ?? "").not.toContain(POISONED_CIPHERTEXT);
		expect(run.error_message ?? "").not.toContain(SECRET_VALUE);
		expect(run.error_message ?? "").not.toContain(ciphertext);
		expectProviderNotCalledWithCiphertext(POISONED_CIPHERTEXT);
		expectProviderNotCalledWithCiphertext(ciphertext);

		const db = await getDB();
		const events = await db
			.selectFrom("sync_audit_event")
			.selectAll()
			.where("sync_run_id", "=", run.id)
			.execute();
		expect(events.map(event => event.action)).toContain("sync_run_failed");
		expect(events.map(event => event.action)).not.toContain("provider_sync_applied");
		const serialized = JSON.stringify({ run, events });
		expect(serialized).not.toContain(SECRET_VALUE);
		expect(serialized).not.toContain(POISONED_CIPHERTEXT);
		expect(serialized).not.toContain(ciphertext);
	});

	test("does not call the provider when the actor has no vault session", async () => {
		await provisionGithubSync();
		const ciphertext = await storedSecretCiphertext();
		setMockVaultSessionFactory(async () => {
			throw new Error("No vault session");
		});

		const run = await EnterpriseIntegrationService.createManualSyncRun(syncRunInput());

		expect(run.status).toBe("failed");
		expect(run.error_message ?? "").toContain("No vault session");
		expect(run.error_message ?? "").not.toContain(SECRET_VALUE);
		expect(run.error_message ?? "").not.toContain(ciphertext);
		expectProviderNotCalledWithCiphertext(ciphertext);

		const db = await getDB();
		const events = await db
			.selectFrom("sync_audit_event")
			.selectAll()
			.where("sync_run_id", "=", run.id)
			.execute();
		expect(events.map(event => event.action)).toContain("sync_run_failed");
		expect(events.map(event => event.action)).not.toContain("provider_sync_applied");
		const serialized = JSON.stringify({ run, events });
		expect(serialized).not.toContain(SECRET_VALUE);
		expect(serialized).not.toContain(ciphertext);
	});
});

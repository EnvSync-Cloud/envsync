import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { cleanupDB, getDB, seedApp, seedEnvType, seedOrg, type SeedOrgResult } from "../helpers/db";
import { MockFGAClient, resetFGA, setupUserOrgTuples } from "../helpers/fga";
import { resetVaultStore } from "../helpers/kms";
import { generateKeyPair } from "@/helpers/key-store";
import { EnterpriseIntegrationService, EnterpriseProviderSyncService } from "envsync-enterprise";

let seed: SeedOrgResult;
let appId: string;
let envTypeId: string;

const originalProviderSync = EnterpriseProviderSyncService.sync;

beforeEach(async () => {
	await cleanupDB();
	resetFGA();
	resetVaultStore();

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

	EnterpriseProviderSyncService.sync = async (context) => ({
		written_count: context.items.length,
		target: {
			target_identifier: context.mapping.target_identifier,
			branch_ref: context.mapping.branch_ref,
			item_keys: context.items.map(item => item.key),
		},
	});
});

afterEach(() => {
	EnterpriseProviderSyncService.sync = originalProviderSync;
});

describe("EnterpriseIntegrationService.createManualSyncRun", () => {
	test("executes a manual provider sync and records summary plus audit events", async () => {
		await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "DATABASE_URL",
				value: "postgres://envsync.local/app",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});
		const secretResponse = await testRequest("/api/secret/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "API_TOKEN",
				value: "super-secret-token",
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

		const run = await EnterpriseIntegrationService.createManualSyncRun({
			org_id: seed.org.id,
			app_id: appId,
			provider_type: "github",
			actor_user_id: seed.masterUser.id,
			metadata: {
				source: "test-suite",
			},
		});

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
	});
});

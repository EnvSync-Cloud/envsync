import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../../helpers/request";
import {
	checkServiceHealth,
	seedE2EOrg,
	type E2ESeed,
} from "../helpers/real-auth";

import { DB } from "@/libs/db";
import {
	EnterpriseProviderSyncService,
	type EnterpriseSyncContext,
	type EnterpriseSyncResult,
} from "envsync-enterprise";

type RecordedSyncCall = {
	connectionName: string;
	targetIdentifier: string;
	branchRef: string | null;
	bindingMetadata: Record<string, unknown>;
	keys: string[];
	envKeys: string[];
	secretKeys: string[];
	resolvedToken: string | null;
};

let seed: E2ESeed;
let appId: string;
let envTypeId: string;
let providerConnectionId: string;
let bindingId: string;
let mappingId: string;
const recordedSyncCalls: RecordedSyncCall[] = [];

const originalProviderSync = EnterpriseProviderSyncService.sync;

function asRecord(value: unknown) {
	return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	const appRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: {
			name: "Enterprise Sync Management E2E",
			description: "Management surface enterprise sync flow",
			enable_secrets: true,
		},
	});
	expect(appRes.status).toBe(201);
	appId = (await appRes.json<{ id: string }>()).id;

	const envTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "production", app_id: appId },
	});
	expect(envTypeRes.status).toBe(201);
	envTypeId = (await envTypeRes.json<{ id: string }>()).id;

	expect((await testRequest("/api/env/single", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			app_id: appId,
			env_type_id: envTypeId,
			key: "API_URL",
			value: "https://api.envsync.test",
		},
	})).status).toBe(201);

	expect((await testRequest("/api/env/single", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			app_id: appId,
			env_type_id: envTypeId,
			key: "FEATURE_FLAG",
			value: "enabled",
		},
	})).status).toBe(201);

	expect((await testRequest("/api/secret/single", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			app_id: appId,
			env_type_id: envTypeId,
			key: "DB_PASSWORD",
			value: "super-secret-password",
		},
	})).status).toBe(201);

	const orgSecretRes = await testRequest("/api/enterprise/org-secrets", {
		method: "POST",
		token: seed.masterUser.token,
		surface: "management",
		body: {
			key: "GITHUB_TOKEN",
			value: "ghp_enterprise_sync_token",
			description: "Used by management enterprise sync tests",
			metadata: {
				provider_refs: ["github"],
				rotation_policy: "manual",
			},
		},
	});
	expect(orgSecretRes.status).toBe(201);

	const providerConnectionRes = await testRequest("/api/enterprise/provider-connections", {
		method: "POST",
		token: seed.masterUser.token,
		surface: "management",
		body: {
			provider_type: "github",
			name: "GitHub Production",
			status: "active",
			auth_config: {
				owner: "envsync-cloud",
				token_secret_ref: "GITHUB_TOKEN",
			},
			metadata: {
				name_prefix: "APP",
			},
		},
	});
	expect(providerConnectionRes.status).toBe(201);
	providerConnectionId = (await providerConnectionRes.json<{ id: string }>()).id;

	const bindingRes = await testRequest(`/api/enterprise/apps/${appId}/bindings`, {
		method: "POST",
		token: seed.masterUser.token,
		surface: "management",
		body: {
			provider_connection_id: providerConnectionId,
			provider_type: "github",
			is_enabled: true,
			metadata: {
				name_prefix: "APP",
				environment: "production",
			},
		},
	});
	expect(bindingRes.status).toBe(201);
	bindingId = (await bindingRes.json<{ id: string }>()).id;

	const mappingRes = await testRequest(`/api/enterprise/apps/${appId}/env-type-mappings`, {
		method: "POST",
		token: seed.masterUser.token,
		surface: "management",
		body: {
			env_type_id: envTypeId,
			integration_binding_id: bindingId,
			target_identifier: "envsync-cloud/envsync",
			branch_ref: "main",
			metadata: {
				environment: "production",
			},
		},
	});
	expect(mappingRes.status).toBe(201);
	mappingId = (await mappingRes.json<{ id: string }>()).id;
});

afterEach(() => {
	recordedSyncCalls.length = 0;
	EnterpriseProviderSyncService.sync = originalProviderSync;
});

afterAll(() => {
	EnterpriseProviderSyncService.sync = originalProviderSync;
});

describe("Enterprise Sync Management E2E", () => {
	test("manual sync run records lifecycle events and compiles env plus secret payloads", async () => {
		EnterpriseProviderSyncService.sync = async (context: EnterpriseSyncContext): Promise<EnterpriseSyncResult> => {
			const db = await DB.getInstance();
			const authConfig = asRecord(context.connection.auth_config);
			const tokenSecretRef = typeof authConfig.token_secret_ref === "string" ? authConfig.token_secret_ref : null;
			const resolvedSecret = tokenSecretRef
				? await db
					.selectFrom("org_secret")
					.select(["key", "value"])
					.where("org_id", "=", context.org_id)
					.where("key", "=", tokenSecretRef)
					.executeTakeFirst()
				: null;

			recordedSyncCalls.push({
				connectionName: context.connection.name,
				targetIdentifier: context.mapping.target_identifier,
				branchRef: context.mapping.branch_ref,
				bindingMetadata: asRecord(context.binding.metadata),
				keys: context.items.map(item => item.key).sort(),
				envKeys: context.items.filter(item => item.kind === "env").map(item => item.key).sort(),
				secretKeys: context.items.filter(item => item.kind === "secret").map(item => item.key).sort(),
				resolvedToken: resolvedSecret?.value ?? null,
			});

			return {
				written_count: context.items.length,
				target: {
					target_identifier: context.mapping.target_identifier,
					branch_ref: context.mapping.branch_ref,
					binding_metadata: context.binding.metadata,
					resolved_token: resolvedSecret?.value ?? null,
				},
			};
		};

		const runRes = await testRequest("/api/enterprise/sync-runs/manual", {
			method: "POST",
			token: seed.masterUser.token,
			surface: "management",
			body: {
				app_id: appId,
				provider_type: "github",
				metadata: {
					trigger: "e2e",
				},
			},
		});
		expect(runRes.status).toBe(201);
		const run = await runRes.json<{ id: string; status: string }>();
		expect(run.status).toBe("succeeded");

		const [eventsRes, runsRes, connectionsRes, bindingsRes, mappingsRes] = await Promise.all([
			testRequest(`/api/enterprise/sync-runs/${run.id}/events`, {
				token: seed.masterUser.token,
				surface: "management",
			}),
			testRequest("/api/enterprise/sync-runs", {
				token: seed.masterUser.token,
				surface: "management",
				query: { app_id: appId },
			}),
			testRequest("/api/enterprise/provider-connections", {
				token: seed.masterUser.token,
				surface: "management",
			}),
			testRequest(`/api/enterprise/apps/${appId}/bindings`, {
				token: seed.masterUser.token,
				surface: "management",
			}),
			testRequest(`/api/enterprise/apps/${appId}/env-type-mappings`, {
				token: seed.masterUser.token,
				surface: "management",
			}),
		]);

		expect(eventsRes.status).toBe(200);
		expect(runsRes.status).toBe(200);
		expect(connectionsRes.status).toBe(200);
		expect(bindingsRes.status).toBe(200);
		expect(mappingsRes.status).toBe(200);

		const events = await eventsRes.json<Array<{ action: string }>>();
		expect(events.map(event => event.action)).toEqual([
			"manual_sync_requested",
			"sync_run_started",
			"binding_resolved",
			"mapping_validated",
			"payload_compiled",
			"provider_target_planned",
			"provider_sync_applied",
			"sync_run_completed",
		]);

		expect(recordedSyncCalls).toHaveLength(1);
		expect(recordedSyncCalls[0]).toEqual({
			connectionName: "GitHub Production",
			targetIdentifier: "envsync-cloud/envsync",
			branchRef: "main",
			bindingMetadata: {
				name_prefix: "APP",
				environment: "production",
			},
			keys: ["API_URL", "DB_PASSWORD", "FEATURE_FLAG"],
			envKeys: ["API_URL", "FEATURE_FLAG"],
			secretKeys: ["DB_PASSWORD"],
			resolvedToken: "ghp_enterprise_sync_token",
		});

		const runs = await runsRes.json<Array<{ id: string; provider_type: string; status: string }>>();
		const connections = await connectionsRes.json<Array<{ id: string; provider_type: string }>>();
		const bindings = await bindingsRes.json<Array<{ id: string; provider_type: string }>>();
		const mappings = await mappingsRes.json<Array<{ id: string; target_identifier: string }>>();

		expect(runs.some(entry => entry.id === run.id && entry.provider_type === "github" && entry.status === "succeeded")).toBe(true);
		expect(connections.some(entry => entry.id === providerConnectionId && entry.provider_type === "github")).toBe(true);
		expect(bindings.some(entry => entry.id === bindingId && entry.provider_type === "github")).toBe(true);
		expect(mappings.some(entry => entry.id === mappingId && entry.target_identifier === "envsync-cloud/envsync")).toBe(true);
	});
});

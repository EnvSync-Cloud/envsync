import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../../helpers/request";
import { managementTestRequest } from "../helpers/management-request";
import {
	checkServiceHealth,
	seedE2EOrg,
	type E2ESeed,
} from "../helpers/real-auth";

type RecordedVercelRequest = {
	method: string;
	pathname: string;
	search: string;
	body: Record<string, unknown>;
};

let seed: E2ESeed;
let appId: string;
let envTypeId: string;
let providerConnectionId: string;
let bindingId: string;
let mappingId: string;
const providerRequests: RecordedVercelRequest[] = [];

const fakeVercelServer = Bun.serve({
	port: 0,
	async fetch(request) {
		const url = new URL(request.url);
		const body = await request.json().catch(() => ({}));
		providerRequests.push({
			method: request.method,
			pathname: url.pathname,
			search: url.search,
			body: typeof body === "object" && body ? body as Record<string, unknown> : {},
		});

		return Response.json({
			ok: true,
			id: crypto.randomUUID(),
			received: body,
		});
	},
});

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	const appRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: {
			name: "E2E Enterprise Sync App",
			description: "Enterprise sync end-to-end flow",
			enable_secrets: true,
		},
	});
	expect(appRes.status).toBe(201);
	appId = (await appRes.json<{ id: string }>()).id;

	const envTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "preview", app_id: appId },
	});
	expect(envTypeRes.status).toBe(201);
	envTypeId = (await envTypeRes.json<{ id: string }>()).id;

	const envRes = await testRequest("/api/env/batch", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			app_id: appId,
			env_type_id: envTypeId,
			envs: [
				{ key: "API_URL", value: "https://preview.envsync.test" },
				{ key: "FEATURE_FLAG", value: "enabled" },
			],
		},
	});
	expect(envRes.status).toBe(201);

	const secretRes = await testRequest("/api/secret/batch", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			app_id: appId,
			env_type_id: envTypeId,
			envs: [
				{ key: "DB_PASSWORD", value: "super-secret-password" },
			],
		},
	});
	expect(secretRes.status).toBe(201);

	const orgSecretRes = await managementTestRequest("/api/enterprise/org-secrets", {
		method: "POST",
		token: seed.masterUser.token,
		body: {
			key: "VERCEL_TOKEN",
			value: "vercel-e2e-token",
			description: "Used by enterprise sync e2e tests",
			metadata: {
				provider_refs: ["vercel"],
				rotation_policy: "manual",
			},
		},
	});
	expect(orgSecretRes.status).toBe(201);

	const providerConnectionRes = await managementTestRequest("/api/enterprise/provider-connections", {
		method: "POST",
		token: seed.masterUser.token,
		body: {
			provider_type: "vercel",
			name: "Local Vercel E2E",
			status: "active",
			auth_config: {
				token_secret_ref: "VERCEL_TOKEN",
				base_url: `http://127.0.0.1:${fakeVercelServer.port}`,
				team_id: "team_e2e",
			},
			metadata: {
				name_prefix: "E2E",
			},
		},
	});
	expect(providerConnectionRes.status).toBe(201);
	providerConnectionId = (await providerConnectionRes.json<{ id: string }>()).id;

	const bindingRes = await managementTestRequest(`/api/enterprise/apps/${appId}/bindings`, {
		method: "POST",
		token: seed.masterUser.token,
		body: {
			provider_connection_id: providerConnectionId,
			provider_type: "vercel",
			is_enabled: true,
			metadata: {
				project_id: "proj_e2e",
				name_prefix: "WEB",
			},
		},
	});
	expect(bindingRes.status).toBe(201);
	bindingId = (await bindingRes.json<{ id: string }>()).id;

	const mappingRes = await managementTestRequest(`/api/enterprise/apps/${appId}/env-type-mappings`, {
		method: "POST",
		token: seed.masterUser.token,
		body: {
			env_type_id: envTypeId,
			integration_binding_id: bindingId,
			target_identifier: "proj_e2e",
			branch_ref: "preview",
			metadata: {
				comment: "E2E manual sync",
			},
		},
	});
	expect(mappingRes.status).toBe(201);
	mappingId = (await mappingRes.json<{ id: string }>()).id;
});

afterAll(() => {
	fakeVercelServer.stop(true);
});

describe("Enterprise Sync E2E", () => {
	test("manual sync run writes envs and secrets to the provider target", async () => {
		providerRequests.length = 0;

		const runRes = await managementTestRequest("/api/enterprise/sync-runs/manual", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				provider_type: "vercel",
				metadata: {
					trigger: "e2e",
				},
			},
		});
		expect(runRes.status).toBe(201);

		const run = await runRes.json<{ id: string; status: string; metadata?: Record<string, unknown> }>();
		expect(run.status).toBe("succeeded");

		const eventsRes = await managementTestRequest(`/api/enterprise/sync-runs/${run.id}/events`, {
			token: seed.masterUser.token,
		});
		expect(eventsRes.status).toBe(200);
		const events = await eventsRes.json<Array<{ action: string; result: string; details?: unknown }>>();
		expect(JSON.stringify(events)).not.toContain("super-secret-password");
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

		expect(providerRequests.length).toBe(3);
		for (const request of providerRequests) {
			expect(request.method).toBe("POST");
			expect(request.pathname).toBe("/v10/projects/proj_e2e/env");
			expect(request.search).toContain("upsert=true");
			expect(request.search).toContain("teamId=team_e2e");
			expect(request.body.target).toEqual(["preview"]);
			expect(request.body.gitBranch).toBe("preview");
			expect(typeof request.body.key).toBe("string");
		}

		const keys = providerRequests.map(request => String(request.body.key)).sort();
		expect(keys).toEqual(["WEB_API_URL", "WEB_DB_PASSWORD", "WEB_FEATURE_FLAG"]);

		const secretRequest = providerRequests.find(request => request.body.key === "WEB_DB_PASSWORD");
		expect(secretRequest?.body.type).toBe("encrypted");
		expect(secretRequest?.body.value).toBe("super-secret-password");
		expect(String(secretRequest?.body.value)).not.toStartWith("RSA:");
		expect(String(secretRequest?.body.value)).not.toStartWith("HYB:");

		const envRequest = providerRequests.find(request => request.body.key === "WEB_API_URL");
		expect(envRequest?.body.type).toBe("plain");
		expect(envRequest?.body.value).toBe("https://preview.envsync.test");
	});

	test("management APIs expose created enterprise topology objects", async () => {
		const [connectionsRes, bindingsRes, mappingsRes, runsRes] = await Promise.all([
			managementTestRequest("/api/enterprise/provider-connections", {
				token: seed.masterUser.token,
			}),
			managementTestRequest(`/api/enterprise/apps/${appId}/bindings`, {
				token: seed.masterUser.token,
			}),
			managementTestRequest(`/api/enterprise/apps/${appId}/env-type-mappings`, {
				token: seed.masterUser.token,
			}),
			managementTestRequest("/api/enterprise/sync-runs", {
				token: seed.masterUser.token,
				query: { app_id: appId },
			}),
		]);

		expect(connectionsRes.status).toBe(200);
		expect(bindingsRes.status).toBe(200);
		expect(mappingsRes.status).toBe(200);
		expect(runsRes.status).toBe(200);

		const connections = await connectionsRes.json<Array<{ id: string; provider_type: string }>>();
		const bindings = await bindingsRes.json<Array<{ id: string; provider_type: string }>>();
		const mappings = await mappingsRes.json<Array<{ id: string; target_identifier: string }>>();
		const runs = await runsRes.json<Array<{ provider_type: string; status: string }>>();

		expect(connections.some(connection => connection.id === providerConnectionId && connection.provider_type === "vercel")).toBe(true);
		expect(bindings.some(binding => binding.id === bindingId && binding.provider_type === "vercel")).toBe(true);
		expect(mappings.some(mapping => mapping.id === mappingId && mapping.target_identifier === "proj_e2e")).toBe(true);
		expect(runs.some(run => run.provider_type === "vercel" && run.status === "succeeded")).toBe(true);
	});
});

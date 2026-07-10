/**
 * E2E: Dynamic Secret Engine & Lease CRUD — engine create → list → get → update,
 *       lease create → list → get → revoke, engine delete
 *
 * Uses real PostgreSQL and OpenFGA.
 * Tests the dynamic secret management surface for short-lived credentials.
 */
import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../../helpers/request";
import { managementTestRequest } from "../helpers/management-request";
import {
	checkServiceHealth,
	seedE2EOrg,
	type E2ESeed,
} from "../helpers/real-auth";

let seed: E2ESeed;
let appId: string;
let envTypeId: string;

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	// Create prerequisite app
	const appRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: {
			name: "E2E Dynamic Secret App",
			description: "App for dynamic secret E2E tests",
			enable_secrets: true,
		},
	});
	expect(appRes.status).toBe(201);
	appId = (await appRes.json<{ id: string }>()).id;

	// Create prerequisite env type
	const envTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "staging", app_id: appId },
	});
	expect(envTypeRes.status).toBe(201);
	envTypeId = (await envTypeRes.json<{ id: string }>()).id;
});

describe("Dynamic Secret Engine E2E", () => {
	let engineId: string;

	test("create dynamic secret engine (postgres)", async () => {
		const res = await managementTestRequest("/api/dynamic_secret/engines", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				engine_type: "postgres",
				name: "e2e-postgres-engine",
				config: {
					host: process.env.DYNAMIC_SECRET_PG_HOST ?? "localhost",
					port: parseInt(process.env.DYNAMIC_SECRET_PG_PORT ?? "5433"),
					database: process.env.DYNAMIC_SECRET_PG_DATABASE ?? "dynamic_secrets",
					superuser: {
						username: process.env.DYNAMIC_SECRET_PG_USER ?? "dynroot",
						password: process.env.DYNAMIC_SECRET_PG_PASSWORD ?? "dynrootpass",
					},
					creation_statements: [
						'CREATE ROLE "{{name}}" WITH LOGIN PASSWORD \'{{password}}\' VALID UNTIL \'{{expiration}}\';',
						'GRANT CONNECT ON DATABASE "{{database}}" TO "{{name}}";',
					],
					default_ttl_seconds: 3600,
					max_ttl_seconds: 86400,
				},
				enabled: true,
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{
			id: string;
			org_id: string;
			engine_type: string;
			name: string;
			enabled: boolean;
		}>();
		expect(body.id).toBeDefined();
		expect(body.org_id).toBe(seed.org.id);
		expect(body.engine_type).toBe("postgres");
		expect(body.name).toBe("e2e-postgres-engine");
		expect(body.enabled).toBe(true);
		engineId = body.id;
	});

	test("list dynamic secret engines returns created engine", async () => {
		const res = await managementTestRequest("/api/dynamic_secret/engines", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<Array<{ id: string; name: string; engine_type: string }>>();
		expect(Array.isArray(body)).toBe(true);
		expect(body.some((e) => e.id === engineId && e.name === "e2e-postgres-engine")).toBe(true);
	});

	test("get dynamic secret engine by ID", async () => {
		const res = await managementTestRequest(`/api/dynamic_secret/engines/${engineId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			id: string;
			engine_type: string;
			name: string;
			config: Record<string, unknown>;
		}>();
		expect(body.id).toBe(engineId);
		expect(body.engine_type).toBe("postgres");
		expect(body.name).toBe("e2e-postgres-engine");
		expect(body.config).toBeDefined();
	});

	test("update dynamic secret engine name", async () => {
		const res = await managementTestRequest(`/api/dynamic_secret/engines/${engineId}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				name: "e2e-postgres-engine-updated",
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ name: string }>();
		expect(body.name).toBe("e2e-postgres-engine-updated");
	});

	test("disable dynamic secret engine", async () => {
		const res = await managementTestRequest(`/api/dynamic_secret/engines/${engineId}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { enabled: false },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ enabled: boolean }>();
		expect(body.enabled).toBe(false);
	});

	test("create lease on disabled engine returns error", async () => {
		const res = await managementTestRequest(`/api/dynamic_secret/engines/${engineId}/leases`, {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				variable_key: "DATABASE_URL",
				ttl_seconds: 3600,
			},
		});
		// Disabled engine should reject lease creation
		expect([400, 409, 422]).toContain(res.status);
	});

	test("re-enable engine and create lease", async () => {
		// Re-enable
		const enableRes = await managementTestRequest(`/api/dynamic_secret/engines/${engineId}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { enabled: true },
		});
		expect(enableRes.status).toBe(200);

		// Create lease
		const res = await managementTestRequest(`/api/dynamic_secret/engines/${engineId}/leases`, {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				variable_key: "DATABASE_URL",
				ttl_seconds: 3600,
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{
			id: string;
			engine_id: string;
			app_id: string;
			env_type_id: string;
			variable_key: string;
			expires_at: string;
			revoked_at: string | null;
		}>();
		expect(body.id).toBeDefined();
		expect(body.engine_id).toBe(engineId);
		expect(body.app_id).toBe(appId);
		expect(body.variable_key).toBe("DATABASE_URL");
		expect(body.revoked_at).toBeNull();
	});

	test("list leases for engine", async () => {
		const res = await managementTestRequest(`/api/dynamic_secret/engines/${engineId}/leases`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<Array<{ id: string; engine_id: string }>>();
		expect(Array.isArray(body)).toBe(true);
		expect(body.length).toBeGreaterThanOrEqual(1);
		expect(body[0].engine_id).toBe(engineId);
	});

	test("delete engine with active lease returns conflict", async () => {
		const res = await managementTestRequest(`/api/dynamic_secret/engines/${engineId}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(409);
	});

	test("revoke lease then delete engine succeeds", async () => {
		// Get the lease ID
		const leasesRes = await managementTestRequest(`/api/dynamic_secret/engines/${engineId}/leases`, {
			token: seed.masterUser.token,
		});
		const leases = await leasesRes.json<Array<{ id: string; revoked_at: string | null }>>();
		const activeLease = leases.find((l) => l.revoked_at === null);
		expect(activeLease).toBeDefined();

		// Revoke
		const revokeRes = await managementTestRequest(
			`/api/dynamic_secret/leases/${activeLease!.id}/revoke`,
			{
				method: "POST",
				token: seed.masterUser.token,
			},
		);
		expect(revokeRes.status).toBe(200);

		const revokeBody = await revokeRes.json<{ message: string; id: string }>();
		expect(revokeBody.message).toBe("Lease revoked successfully");
		expect(revokeBody.id).toBe(activeLease!.id);

		// Now delete engine
		const deleteRes = await managementTestRequest(`/api/dynamic_secret/engines/${engineId}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(deleteRes.status).toBe(200);

		const deleteBody = await deleteRes.json<{ message: string }>();
		expect(deleteBody.message).toBe("Dynamic secret engine deleted successfully");
	});

	test("get deleted engine returns 404", async () => {
		const res = await managementTestRequest(`/api/dynamic_secret/engines/${engineId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(404);
	});

	test("create engine with invalid type returns 400", async () => {
		const res = await managementTestRequest("/api/dynamic_secret/engines", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				engine_type: "unsupported_db",
				name: "bad-engine",
				config: {},
			},
		});
		expect(res.status).toBe(400);
	});

	test("create engine with missing config fields returns 400", async () => {
		const res = await managementTestRequest("/api/dynamic_secret/engines", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				engine_type: "postgres",
				name: "incomplete-engine",
				config: {
					host: "db.example.com",
					// missing database, superuser, creation_statements
				},
			},
		});
		expect(res.status).toBe(400);
	});

	test("cleanup expired leases returns success", async () => {
		const res = await managementTestRequest("/api/dynamic_secret/leases/cleanup", {
			method: "POST",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ cleaned: number }>();
		expect(typeof body.cleaned).toBe("number");
	});
});

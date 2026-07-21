/**
 * E2E: Rotation Policy CRUD — create → list → get → update → delete
 *
 * Uses real PostgreSQL and OpenFGA.
 * Tests the secret rotation policy management surface.
 * Requires an app and env_type as prerequisites for rotation policies.
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
			name: "E2E Rotation App",
			description: "App for rotation policy E2E tests",
			enable_secrets: true,
		},
	});
	expect(appRes.status).toBe(201);
	appId = (await appRes.json<{ id: string }>()).id;

	// Create prerequisite env type
	const envTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "production", app_id: appId },
	});
	expect(envTypeRes.status).toBe(201);
	envTypeId = (await envTypeRes.json<{ id: string }>()).id;

	// Create a secret to rotate
	const secretRes = await testRequest("/api/secret/batch", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			app_id: appId,
			env_type_id: envTypeId,
			envs: [
				{ key: "DB_PASSWORD", value: "initial-password" },
			],
		},
	});
	expect(secretRes.status).toBe(201);
});

describe("Rotation Policy E2E", () => {
	let policyId: string;

	test("create rotation policy for DB_PASSWORD", async () => {
		const res = await managementTestRequest("/api/rotation", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				variable_key: "DB_PASSWORD",
				engine_type: "postgres",
				schedule_cron: "0 */6 * * *",
				dual_window_minutes: 120,
				enabled: true,
				connection_config: {
					host: "db.example.com",
					port: 5432,
					database: "mydb",
					admin_user: "postgres",
					admin_password: "postgres",
				},
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{
			id: string;
			org_id: string;
			app_id: string;
			env_type_id: string;
			variable_key: string;
			engine_type: string;
			schedule_cron: string;
			dual_window_minutes: number;
			enabled: boolean;
		}>();
		expect(body.id).toBeDefined();
		expect(body.org_id).toBe(seed.org.id);
		expect(body.app_id).toBe(appId);
		expect(body.env_type_id).toBe(envTypeId);
		expect(body.variable_key).toBe("DB_PASSWORD");
		expect(body.engine_type).toBe("postgres");
		expect(body.schedule_cron).toBe("0 */6 * * *");
		expect(body.dual_window_minutes).toBe(120);
		expect(body.enabled).toBe(true);
		policyId = body.id;
	});

	test("list rotation policies returns created policy", async () => {
		const res = await managementTestRequest("/api/rotation", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<Array<{ id: string; variable_key: string }>>();
		expect(Array.isArray(body)).toBe(true);
		expect(body.some((p) => p.id === policyId && p.variable_key === "DB_PASSWORD")).toBe(true);
	});

	test("list rotation policies filtered by app_id", async () => {
		const res = await managementTestRequest("/api/rotation", {
			token: seed.masterUser.token,
			query: { app_id: appId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<Array<{ id: string; app_id: string }>>();
		expect(body.every((p) => p.app_id === appId)).toBe(true);
	});

	test("list rotation policies filtered by enabled=true", async () => {
		const res = await managementTestRequest("/api/rotation", {
			token: seed.masterUser.token,
			query: { enabled: "true" },
		});
		expect(res.status).toBe(200);

		const body = await res.json<Array<{ id: string; enabled: boolean }>>();
		expect(body.every((p) => p.enabled === true)).toBe(true);
	});

	test("get rotation policy by ID", async () => {
		const res = await managementTestRequest(`/api/rotation/${policyId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			id: string;
			variable_key: string;
			engine_type: string;
			schedule_cron: string;
		}>();
		expect(body.id).toBe(policyId);
		expect(body.variable_key).toBe("DB_PASSWORD");
		expect(body.engine_type).toBe("postgres");
	});

	test("update rotation policy schedule and window", async () => {
		const res = await managementTestRequest(`/api/rotation/${policyId}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				schedule_cron: "0 */12 * * *",
				dual_window_minutes: 240,
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			schedule_cron: string;
			dual_window_minutes: number;
		}>();
		expect(body.schedule_cron).toBe("0 */12 * * *");
		expect(body.dual_window_minutes).toBe(240);
	});

	test("disable rotation policy", async () => {
		const res = await managementTestRequest(`/api/rotation/${policyId}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { enabled: false },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ enabled: boolean }>();
		expect(body.enabled).toBe(false);
	});

	test("get rotation states for policy", async () => {
		const res = await managementTestRequest(`/api/rotation/${policyId}/states`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<Array<{ id: string; rotation_policy_id: string }>>();
		expect(Array.isArray(body)).toBe(true);
		// No rotations triggered yet, so should be empty
		expect(body.length).toBe(0);
	});

	test("delete rotation policy", async () => {
		const res = await managementTestRequest(`/api/rotation/${policyId}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Rotation policy deleted successfully");
	});

	test("get deleted rotation policy returns 404", async () => {
		const res = await managementTestRequest(`/api/rotation/${policyId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(404);
	});

	test("create rotation policy with missing required fields returns 400", async () => {
		const res = await managementTestRequest("/api/rotation", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				// missing env_type_id, variable_key, engine_type, schedule_cron
			},
		});
		expect(res.status).toBe(400);
	});

	test("create rotation policy with invalid engine_type returns 400", async () => {
		const res = await managementTestRequest("/api/rotation", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				variable_key: "DB_PASSWORD",
				engine_type: "invalid_engine",
				schedule_cron: "0 */6 * * *",
			},
		});
		expect(res.status).toBe(400);
	});

	test("get rotation policy with invalid UUID returns 400", async () => {
		const res = await managementTestRequest("/api/rotation/not-a-uuid", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(400);
	});

	test("revoke expired credentials returns success", async () => {
		const res = await managementTestRequest("/api/rotation/revoke-expired", {
			method: "POST",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string; processed: number }>();
		expect(body.message).toBe("Expired credential revocation completed");
		expect(typeof body.processed).toBe("number");
	});
});

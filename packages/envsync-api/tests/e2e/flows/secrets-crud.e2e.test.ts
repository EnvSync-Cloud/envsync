/**
 * E2E: Secrets CRUD — create single/batch → list → update → delete
 *
 * Uses real PostgreSQL and OpenFGA. Vault stores encrypted secrets.
 * Requires app with enable_secrets: true.
 *
 * Note: GET /api/secret/i/:key is skipped because the controller reads
 * app_id and env_type_id from c.req.param() but they're not URL params.
 * Note: Reveal is skipped because it requires is_managed_secret + private key setup.
 */
import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../../helpers/request";
import {
	seedE2EOrg,
	checkServiceHealth,
	type E2ESeed,
} from "../helpers/real-auth";

let seed: E2ESeed;
let appId: string;
let envTypeId: string;

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	// Create app with secrets enabled
	const appRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: {
			name: "E2E Secrets App",
			description: "For secret CRUD tests",
			enable_secrets: true,
		},
	});
	const appBody = await appRes.json<{ id: string }>();
	appId = appBody.id;

	// Create env type
	const envTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "secrets-staging", app_id: appId },
	});
	const envTypeBody = await envTypeRes.json<{ id: string }>();
	envTypeId = envTypeBody.id;
});

describe("Secrets CRUD E2E", () => {
	test("create single secret", async () => {
		const res = await testRequest("/api/secret/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				key: "DB_PASSWORD",
				value: "super-secret-password",
			},
		});
		expect(res.status).toBe(201);
	});

	test("create batch secrets", async () => {
		const res = await testRequest("/api/secret/batch", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				envs: [
					{ key: "API_SECRET", value: "sk-secret-123" },
					{ key: "JWT_SECRET", value: "jwt-secret-456" },
				],
			},
		});
		expect(res.status).toBe(201);
	});

	test("list secrets", async () => {
		const res = await testRequest("/api/secret", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		expect(body.length).toBeGreaterThanOrEqual(3);
	});

	test("update single secret", async () => {
		const res = await testRequest("/api/secret/i/DB_PASSWORD", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				value: "updated-secret-password",
			},
		});
		expect(res.status).toBe(200);
	});

	test("batch update secrets", async () => {
		const res = await testRequest("/api/secret/batch", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				envs: [
					{ key: "API_SECRET", value: "sk-updated-789" },
				],
			},
		});
		expect(res.status).toBe(200);
	});

	test("delete single secret", async () => {
		const res = await testRequest("/api/secret", {
			method: "DELETE",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				key: "JWT_SECRET",
			},
		});
		expect(res.status).toBe(200);
	});

	test("batch delete secrets", async () => {
		const res = await testRequest("/api/secret/batch", {
			method: "DELETE",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				keys: ["API_SECRET"],
			},
		});
		expect(res.status).toBe(200);
	});
});

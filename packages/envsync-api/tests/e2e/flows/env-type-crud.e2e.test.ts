/**
 * E2E: Env type CRUD — create → list → get → update → delete
 *
 * Uses real PostgreSQL and OpenFGA (real tuple writes).
 *
 * Note: GET /:id controller reads `id` from request body, which is invalid
 * for GET requests. We verify via list filtering instead.
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

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	// Create an app to associate env types with
	const appRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "E2E EnvType App", description: "For env type CRUD tests" },
	});
	const appBody = await appRes.json<{ id: string }>();
	appId = appBody.id;
});

describe("Env Type CRUD E2E", () => {
	let stagingId: string;
	let productionId: string;

	test("create env type (staging)", async () => {
		const res = await testRequest("/api/env_type", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "staging", app_id: appId },
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; name: string }>();
		expect(body.id).toBeDefined();
		expect(body.name).toBe("staging");
		stagingId = body.id;
	});

	test("create env type (production)", async () => {
		const res = await testRequest("/api/env_type", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "production", app_id: appId, is_protected: true },
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; name: string }>();
		expect(body.id).toBeDefined();
		productionId = body.id;
	});

	test("list env types", async () => {
		const res = await testRequest("/api/env_type", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		expect(body.length).toBeGreaterThanOrEqual(2);
	});

	test("get env type by ID (via list)", async () => {
		const res = await testRequest("/api/env_type", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		const found = body.find((et: any) => et.id === stagingId);
		expect(found).toBeDefined();
		expect(found.name).toBe("staging");
	});

	test("update env type name", async () => {
		const res = await testRequest(`/api/env_type/${stagingId}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { id: stagingId, name: "staging-v2" },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Env type updated successfully.");
	});

	test("delete env type", async () => {
		const res = await testRequest(`/api/env_type/${productionId}`, {
			method: "DELETE",
			token: seed.masterUser.token,
			body: { id: productionId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Env type deleted successfully.");
	});

	test("verify deletion (not in list)", async () => {
		const res = await testRequest("/api/env_type", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		const found = body.find((et: any) => et.id === productionId);
		expect(found).toBeUndefined();
	});
});

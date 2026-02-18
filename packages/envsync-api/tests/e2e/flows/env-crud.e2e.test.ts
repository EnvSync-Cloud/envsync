/**
 * E2E: Environment variable CRUD — create → read → update → delete
 *
 * Uses real PostgreSQL and OpenFGA. Vault stores KMS-encrypted env vars.
 * Tests single and batch operations. Values are transparently encrypted/decrypted
 * by EnvService — the API always returns plaintext.
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

	// Create app
	const appRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "E2E Env App", description: "For env CRUD tests" },
	});
	const appBody = await appRes.json<{ id: string }>();
	appId = appBody.id;

	// Create env type
	const envTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "staging", app_id: appId },
	});
	const envTypeBody = await envTypeRes.json<{ id: string }>();
	envTypeId = envTypeBody.id;
});

describe("Env CRUD E2E", () => {
	test("create a single env variable", async () => {
		const res = await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				key: "DATABASE_URL",
				value: "postgres://localhost:5432/mydb",
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string }>();
		expect(body.id).toContain("DATABASE_URL");
	});

	test("create batch env variables", async () => {
		const res = await testRequest("/api/env/batch", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				envs: [
					{ key: "REDIS_URL", value: "redis://localhost:6379" },
					{ key: "API_KEY", value: "sk-test-123" },
				],
			},
		});
		expect(res.status).toBe(201);
	});

	test("read all env variables for env type", async () => {
		const res = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		expect(body.length).toBeGreaterThanOrEqual(3);
	});

	test("env values are returned as plaintext (decrypted transparently)", async () => {
		const res = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		const dbUrl = body.find((e: any) => e.key === "DATABASE_URL");
		expect(dbUrl).toBeDefined();
		expect(dbUrl.value).toBe("postgres://localhost:5432/mydb");

		const redisUrl = body.find((e: any) => e.key === "REDIS_URL");
		expect(redisUrl).toBeDefined();
		expect(redisUrl.value).toBe("redis://localhost:6379");
	});

	test("update a single env variable", async () => {
		const res = await testRequest("/api/env/i/DATABASE_URL", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				value: "postgres://localhost:5432/updateddb",
			},
		});
		expect(res.status).toBe(200);
	});

	test("delete a single env variable", async () => {
		const res = await testRequest("/api/env", {
			method: "DELETE",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				key: "API_KEY",
			},
		});
		expect(res.status).toBe(200);
	});

	test("verify delete removed the variable", async () => {
		const res = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		const keys = body.map((e: any) => e.key);
		expect(keys).not.toContain("API_KEY");
		expect(keys).toContain("DATABASE_URL");
		expect(keys).toContain("REDIS_URL");
	});
});

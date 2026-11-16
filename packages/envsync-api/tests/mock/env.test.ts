import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { seedOrg, seedApp, seedEnvType, type SeedOrgResult } from "../helpers/db";
import { MockFGAClient, resetFGA, setupUserOrgTuples } from "../helpers/fga";
import { resetVaultStore } from "../helpers/kms";

let seed: SeedOrgResult;
let appId: string;
let appName: string;
let envTypeId: string;
let envTypeName: string;

beforeAll(async () => {
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

	const app = await seedApp(seed.org.id);
	appId = app.id;
	appName = app.name;

	const envType = await seedEnvType(seed.org.id, appId);
	envTypeId = envType.id;
	envTypeName = envType.name;

	// Write FGA structural tuples for the env type (normally done by API on create)
	await MockFGAClient.writeTuples([
		{ user: `app:${appId}`, relation: "app", object: `env_type:${envTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `env_type:${envTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `app:${appId}` },
	]);
});

afterEach(() => {
	resetVaultStore();
});

describe("PUT /api/env/single", () => {
	test("creates a single env variable", async () => {
		const res = await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "DATABASE_URL",
				value: "postgres://localhost:5432/mydb",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string }>();
		expect(body.id).toBeDefined();
		expect(body.id).toContain("DATABASE_URL");
	});

	test("returns 400 when key is missing", async () => {
		const res = await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				value: "some-value",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});
		expect(res.status).toBe(400);
	});

	test("returns 400 when creating duplicate key", async () => {
		// Create first
		await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "DUPLICATE_KEY",
				value: "first",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});

		// Try to create again
		const res = await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "DUPLICATE_KEY",
				value: "second",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});
		expect(res.status).toBe(400);
	});
});

describe("POST /api/env/ (get all)", () => {
	test("returns all env variables for an env type", async () => {
		// Create a couple of vars
		await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: { key: "VAR_A", value: "aaa", app_id: appId, env_type_id: envTypeId },
		});
		await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: { key: "VAR_B", value: "bbb", app_id: appId, env_type_id: envTypeId },
		});

		const res = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body.length).toBeGreaterThanOrEqual(2);
	});
});

describe("PATCH /api/env/i/:key", () => {
	test("updates an env variable", async () => {
		// Create first
		await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: { key: "UPDATE_ME", value: "old-value", app_id: appId, env_type_id: envTypeId },
		});

		const res = await testRequest("/api/env/i/UPDATE_ME", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { value: "new-value", app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Env updated successfully");
	});

	test("returns 404 when env variable does not exist", async () => {
		const res = await testRequest("/api/env/i/NONEXISTENT", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { value: "nope", app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(404);
	});
});

describe("DELETE /api/env/", () => {
	test("deletes a single env variable", async () => {
		// Create first
		await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: { key: "DELETE_ME", value: "bye", app_id: appId, env_type_id: envTypeId },
		});

		const res = await testRequest("/api/env", {
			method: "DELETE",
			token: seed.masterUser.token,
			body: { key: "DELETE_ME", app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Env deleted successfully");
	});

	test("returns 404 when deleting non-existent variable", async () => {
		const res = await testRequest("/api/env", {
			method: "DELETE",
			token: seed.masterUser.token,
			body: { key: "NOPE", app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(404);
	});
});

describe("PUT /api/env/batch", () => {
	test("creates multiple env variables at once", async () => {
		const res = await testRequest("/api/env/batch", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				envs: [
					{ key: "BATCH_1", value: "val1" },
					{ key: "BATCH_2", value: "val2" },
					{ key: "BATCH_3", value: "val3" },
				],
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Envs created successfully");
	});
});

describe("POST /api/env by project and environment name", () => {
	test("returns the same rows as the id form", async () => {
		await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "NAME_SCOPE",
				value: "from-name",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});

		const byId = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		const byName = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_name: appName, env_type_name: envTypeName },
		});

		expect(byId.status).toBe(200);
		expect(byName.status).toBe(200);

		const pick = (
			rows: Array<{ key: string; value: string; app_id: string; env_type_id: string }>,
		) =>
			rows
				.map(row => ({
					key: row.key,
					value: row.value,
					app_id: row.app_id,
					env_type_id: row.env_type_id,
				}))
				.sort((left, right) => left.key.localeCompare(right.key));

		expect(pick(await byName.json())).toEqual(pick(await byId.json()));
	});

	test("returns 404 when the environment name does not match case", async () => {
		const res = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_name: appName, env_type_name: envTypeName.toUpperCase() },
		});
		expect(res.status).toBe(404);
	});

	test("returns 400 when the id and name identify different projects", async () => {
		const other = await seedApp(seed.org.id, { name: `Other Project ${Date.now()}` });
		const res = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				app_name: other.name,
				env_type_id: envTypeId,
			},
		});
		expect(res.status).toBe(400);
	});
});

describe("Transparent decryption roundtrip", () => {
	test("create env var and read back matches original plaintext", async () => {
		const originalValue = "postgres://user:pass@host:5432/db";

		await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: { key: "ROUNDTRIP_VAR", value: originalValue, app_id: appId, env_type_id: envTypeId },
		});

		const res = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		const found = body.find((e: any) => e.key === "ROUNDTRIP_VAR");
		expect(found).toBeDefined();
		expect(found.value).toBe(originalValue);
	});
});

describe("PATCH /api/env/batch", () => {
	test("updates multiple env variables", async () => {
		// Create vars first
		await testRequest("/api/env/batch", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				envs: [
					{ key: "BUPD_1", value: "old1" },
					{ key: "BUPD_2", value: "old2" },
				],
			},
		});

		const res = await testRequest("/api/env/batch", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				envs: [
					{ key: "BUPD_1", value: "new1" },
					{ key: "BUPD_2", value: "new2" },
				],
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Envs updated successfully");
	});
});

describe("DELETE /api/env/batch", () => {
	test("removes multiple env variables", async () => {
		// Create vars first
		await testRequest("/api/env/batch", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				envs: [
					{ key: "BDEL_1", value: "val1" },
					{ key: "BDEL_2", value: "val2" },
				],
			},
		});

		const res = await testRequest("/api/env/batch", {
			method: "DELETE",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				keys: ["BDEL_1", "BDEL_2"],
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Envs deleted successfully");
	});
});

import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { seedOrg, seedApp, seedEnvType, type SeedOrgResult } from "../helpers/db";
import { MockFGAClient, resetFGA, setupUserOrgTuples } from "../helpers/fga";
import { resetVault } from "../helpers/vault";
import { generateKeyPair } from "@/helpers/key-store";

let seed: SeedOrgResult;
let appId: string;
let envTypeId: string;

// Managed secret app
let managedAppId: string;
let managedEnvTypeId: string;

// Non-managed app (secrets enabled but not managed)
let nonManagedAppId: string;
let nonManagedEnvTypeId: string;

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

	// App with secrets enabled (BYOK, not managed)
	const keyPair = generateKeyPair();
	const app = await seedApp(seed.org.id, {
		enableSecrets: true,
		publicKey: keyPair.publicKey,
		privateKey: keyPair.privateKey,
	});
	appId = app.id;

	const envType = await seedEnvType(seed.org.id, appId);
	envTypeId = envType.id;

	// Managed secret app (server holds the private key)
	const managedKeyPair = generateKeyPair();
	const managedApp = await seedApp(seed.org.id, {
		enableSecrets: true,
		isManagedSecret: true,
		publicKey: managedKeyPair.publicKey,
		privateKey: managedKeyPair.privateKey,
	});
	managedAppId = managedApp.id;

	const managedEnvType = await seedEnvType(seed.org.id, managedAppId);
	managedEnvTypeId = managedEnvType.id;

	// Non-managed app (for reveal 403 test)
	const nonManagedKeyPair = generateKeyPair();
	const nonManagedApp = await seedApp(seed.org.id, {
		enableSecrets: true,
		isManagedSecret: false,
		publicKey: nonManagedKeyPair.publicKey,
		privateKey: nonManagedKeyPair.privateKey,
	});
	nonManagedAppId = nonManagedApp.id;

	const nonManagedEnvType = await seedEnvType(seed.org.id, nonManagedAppId);
	nonManagedEnvTypeId = nonManagedEnvType.id;

	// Write FGA structural tuples for all env types
	await MockFGAClient.writeTuples([
		{ user: `app:${appId}`, relation: "app", object: `env_type:${envTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `env_type:${envTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `app:${appId}` },

		{ user: `app:${managedAppId}`, relation: "app", object: `env_type:${managedEnvTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `env_type:${managedEnvTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `app:${managedAppId}` },

		{ user: `app:${nonManagedAppId}`, relation: "app", object: `env_type:${nonManagedEnvTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `env_type:${nonManagedEnvTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `app:${nonManagedAppId}` },
	]);
});

afterEach(() => {
	resetVault();
});

describe("PUT /api/secret/single", () => {
	test("creates a single secret", async () => {
		const res = await testRequest("/api/secret/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "DB_PASSWORD",
				value: "super-secret-123",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string }>();
		expect(body.id).toBeDefined();
		expect(body.id).toContain("DB_PASSWORD");
	});

	test("returns 400 when key is missing", async () => {
		const res = await testRequest("/api/secret/single", {
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

	test("returns 400 for duplicate secret", async () => {
		// Create first
		await testRequest("/api/secret/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "DUP_SECRET",
				value: "first",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});

		// Try to create again
		const res = await testRequest("/api/secret/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "DUP_SECRET",
				value: "second",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});
		expect(res.status).toBe(400);
	});
});

describe("PUT /api/secret/batch", () => {
	test("creates multiple secrets", async () => {
		const res = await testRequest("/api/secret/batch", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				envs: [
					{ key: "BATCH_SECRET_1", value: "val1" },
					{ key: "BATCH_SECRET_2", value: "val2" },
					{ key: "BATCH_SECRET_3", value: "val3" },
				],
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ message: string }>();
		expect(body.message).toContain("Secrets created successfully");
	});
});

describe("POST /api/secret (list)", () => {
	test("returns secrets with RSA:/HYB: blobs (KMS-unwrapped)", async () => {
		// Create a couple of secrets
		await testRequest("/api/secret/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: { key: "LIST_A", value: "aaa", app_id: appId, env_type_id: envTypeId },
		});
		await testRequest("/api/secret/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: { key: "LIST_B", value: "bbb", app_id: appId, env_type_id: envTypeId },
		});

		const res = await testRequest("/api/secret", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body.length).toBeGreaterThanOrEqual(2);

		// After KMS unwrap, values should be RSA: or HYB: prefixed (inner BYOK layer)
		for (const secret of body) {
			expect(
				secret.value.startsWith("RSA:") || secret.value.startsWith("HYB:"),
			).toBe(true);
		}
	});
});

describe("PATCH /api/secret/i/:key", () => {
	test("updates a secret", async () => {
		// Create first
		await testRequest("/api/secret/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: { key: "UPDATE_SECRET", value: "old-value", app_id: appId, env_type_id: envTypeId },
		});

		const res = await testRequest("/api/secret/i/UPDATE_SECRET", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { value: "new-value", app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toContain("Secret updated successfully");
	});

	test("returns 404 for non-existent secret", async () => {
		const res = await testRequest("/api/secret/i/NONEXISTENT_SECRET", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { value: "nope", app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(404);
	});
});

describe("DELETE /api/secret", () => {
	test("deletes a single secret", async () => {
		// Create first
		await testRequest("/api/secret/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: { key: "DELETE_SECRET", value: "bye", app_id: appId, env_type_id: envTypeId },
		});

		const res = await testRequest("/api/secret", {
			method: "DELETE",
			token: seed.masterUser.token,
			body: { key: "DELETE_SECRET", app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toContain("Secret deleted successfully");
	});

	test("returns 404 for non-existent secret", async () => {
		const res = await testRequest("/api/secret", {
			method: "DELETE",
			token: seed.masterUser.token,
			body: { key: "NOPE_SECRET", app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(404);
	});
});

describe("DELETE /api/secret/batch", () => {
	test("batch deletes secrets", async () => {
		// Create secrets first
		await testRequest("/api/secret/batch", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				envs: [
					{ key: "BD_SECRET_1", value: "val1" },
					{ key: "BD_SECRET_2", value: "val2" },
				],
			},
		});

		const res = await testRequest("/api/secret/batch", {
			method: "DELETE",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				keys: ["BD_SECRET_1", "BD_SECRET_2"],
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toContain("Secrets deleted successfully");
	});
});

describe("POST /api/secret/reveal", () => {
	test("returns plaintext for managed secrets", async () => {
		// Create a secret on the managed app
		await testRequest("/api/secret/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "MANAGED_SECRET",
				value: "my-plaintext-value",
				app_id: managedAppId,
				env_type_id: managedEnvTypeId,
			},
		});

		const res = await testRequest("/api/secret/reveal", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: managedAppId,
				env_type_id: managedEnvTypeId,
				keys: ["MANAGED_SECRET"],
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body.length).toBe(1);
		expect(body[0].key).toBe("MANAGED_SECRET");
		expect(body[0].value).toBe("my-plaintext-value");
	});

	test("returns 403 for non-managed apps", async () => {
		// Create a secret on the non-managed app
		await testRequest("/api/secret/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "NON_MANAGED_SECRET",
				value: "some-value",
				app_id: nonManagedAppId,
				env_type_id: nonManagedEnvTypeId,
			},
		});

		const res = await testRequest("/api/secret/reveal", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: nonManagedAppId,
				env_type_id: nonManagedEnvTypeId,
				keys: ["NON_MANAGED_SECRET"],
			},
		});
		expect(res.status).toBe(403);
	});
});

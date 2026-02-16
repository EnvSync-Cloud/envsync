/**
 * E2E: App lifecycle — create → list → get → update → delete
 *
 * Uses real PostgreSQL and OpenFGA (real tuple writes).
 * Vault and Zitadel are mocked (via real-setup.ts preload).
 */
import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../../helpers/request";
import {
	seedE2EOrg,
	seedE2EUser,
	setupE2EUserPermissions,
	checkServiceHealth,
	type E2ESeed,
} from "../helpers/real-auth";

let seed: E2ESeed;
let viewerUser: { id: string; token: string };

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	// Create a viewer user with limited permissions
	viewerUser = await seedE2EUser(seed.org.id, seed.roles.viewer.id);
	await setupE2EUserPermissions(viewerUser.id, seed.org.id, { can_view: true });
});

describe("App Lifecycle E2E", () => {
	let appId: string;

	test("master creates an app", async () => {
		const res = await testRequest("/api/app", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "E2E Lifecycle App", description: "Created in E2E test" },
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; name: string }>();
		expect(body.id).toBeDefined();
		expect(body.name).toBe("E2E Lifecycle App");
		appId = body.id;
	});

	test("list apps includes the created app", async () => {
		const res = await testRequest("/api/app", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		expect(body.some((a: any) => a.id === appId)).toBe(true);
	});

	test("get app by ID returns details", async () => {
		const res = await testRequest(`/api/app/${appId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; name: string; description: string }>();
		expect(body.id).toBe(appId);
		expect(body.name).toBe("E2E Lifecycle App");
	});

	test("viewer cannot create apps (403)", async () => {
		const res = await testRequest("/api/app", {
			method: "POST",
			token: viewerUser.token,
			body: { name: "Should Fail", description: "Forbidden" },
		});
		expect(res.status).toBe(403);
	});

	test("master updates the app", async () => {
		const res = await testRequest(`/api/app/${appId}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { name: "E2E Updated App" },
		});
		expect(res.status).toBe(200);
	});

	test("verify update took effect", async () => {
		const res = await testRequest(`/api/app/${appId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ name: string }>();
		expect(body.name).toBe("E2E Updated App");
	});

	test("master deletes the app", async () => {
		const res = await testRequest(`/api/app/${appId}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});

	test("deleted app returns 500 (not found)", async () => {
		const res = await testRequest(`/api/app/${appId}`, {
			token: seed.masterUser.token,
		});
		// executeTakeFirstOrThrow will throw → 500
		expect(res.status).toBe(500);
	});
});

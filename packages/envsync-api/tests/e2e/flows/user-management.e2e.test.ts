/**
 * E2E: User management — list → get → update → role change → delete
 *
 * Uses real PostgreSQL and OpenFGA.
 */
import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../../helpers/request";
import {
	seedE2EOrg,
	seedE2EUser,
	setupE2EUserPermissions,
	checkServiceHealth,
	type E2ESeed,
	type E2EUser,
} from "../helpers/real-auth";

let seed: E2ESeed;
let developerUser: E2EUser;
let viewerUser: E2EUser;
let userToDelete: E2EUser;

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	developerUser = await seedE2EUser(seed.org.id, seed.roles.developer.id);
	await setupE2EUserPermissions(developerUser.id, seed.org.id, {
		can_view: true,
		can_edit: true,
	});

	viewerUser = await seedE2EUser(seed.org.id, seed.roles.viewer.id);
	await setupE2EUserPermissions(viewerUser.id, seed.org.id, {
		can_view: true,
	});

	userToDelete = await seedE2EUser(seed.org.id, seed.roles.viewer.id);
	await setupE2EUserPermissions(userToDelete.id, seed.org.id, {
		can_view: true,
	});
});

describe("User Management E2E", () => {
	test("list users", async () => {
		const res = await testRequest("/api/user", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		// master + developer + viewer + userToDelete = at least 4
		expect(body.length).toBeGreaterThanOrEqual(4);
	});

	test("get user by ID", async () => {
		const res = await testRequest(`/api/user/${developerUser.id}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; email: string }>();
		expect(body.id).toBe(developerUser.id);
		expect(body.email).toBe(developerUser.email);
	});

	test("update own profile", async () => {
		const res = await testRequest(`/api/user/${developerUser.id}`, {
			method: "PATCH",
			token: developerUser.token,
			body: { full_name: "E2E Updated Developer" },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("User updated successfully.");
	});

	test("master changes user role", async () => {
		const res = await testRequest(`/api/user/role/${developerUser.id}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { role_id: seed.roles.admin.id },
		});
		expect(res.status).toBe(200);
	});

	test("viewer cannot change roles (403)", async () => {
		const res = await testRequest(`/api/user/role/${developerUser.id}`, {
			method: "PATCH",
			token: viewerUser.token,
			body: { role_id: seed.roles.viewer.id },
		});
		expect(res.status).toBe(403);
	});

	test("master deletes user", async () => {
		const res = await testRequest(`/api/user/${userToDelete.id}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});

	test("verify deleted user gone", async () => {
		const res = await testRequest("/api/user", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		const ids = body.map((u: any) => u.id);
		expect(ids).not.toContain(userToDelete.id);
	});
});

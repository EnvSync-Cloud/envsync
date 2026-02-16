import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { seedOrg, seedUser, type SeedOrgResult } from "../helpers/db";
import { setupUserOrgTuples } from "../helpers/fga";

let seed: SeedOrgResult;
let memberUser: { id: string; email: string; token: string };

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

	memberUser = await seedUser(seed.org.id, seed.roles.developer.id);
	setupUserOrgTuples(memberUser.id, seed.org.id, {
		can_view: true,
		can_edit: true,
	});
});

describe("GET /api/user", () => {
	test("returns list of org users", async () => {
		const res = await testRequest("/api/user", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body.length).toBeGreaterThanOrEqual(2);
	});
});

describe("GET /api/user/:id", () => {
	test("returns user details", async () => {
		const res = await testRequest(`/api/user/${memberUser.id}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; email: string }>();
		expect(body.id).toBe(memberUser.id);
		expect(body.email).toBe(memberUser.email);
	});
});

describe("PATCH /api/user/:id", () => {
	test("updates user full_name", async () => {
		const res = await testRequest(`/api/user/${memberUser.id}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { full_name: "Updated Name" },
		});
		expect(res.status).toBe(200);
	});
});

describe("PATCH /api/user/role/:id", () => {
	test("master can change user role", async () => {
		const res = await testRequest(`/api/user/role/${memberUser.id}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { role_id: seed.roles.manager.id },
		});
		expect(res.status).toBe(200);
	});

	test("non-admin gets 403", async () => {
		const res = await testRequest(`/api/user/role/${memberUser.id}`, {
			method: "PATCH",
			token: memberUser.token,
			body: { role_id: seed.roles.viewer.id },
		});
		expect(res.status).toBe(403);
	});
});

describe("DELETE /api/user/:id", () => {
	test("master can delete a user", async () => {
		// Create a user to delete
		const toDelete = await seedUser(seed.org.id, seed.roles.viewer.id);
		setupUserOrgTuples(toDelete.id, seed.org.id, { can_view: true });

		const res = await testRequest(`/api/user/${toDelete.id}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});

	test("non-admin gets 403", async () => {
		const toDelete = await seedUser(seed.org.id, seed.roles.viewer.id);

		const res = await testRequest(`/api/user/${toDelete.id}`, {
			method: "DELETE",
			token: memberUser.token,
		});
		expect(res.status).toBe(403);
	});
});

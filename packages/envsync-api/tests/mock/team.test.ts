import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { seedOrg, seedUser, type SeedOrgResult } from "../helpers/db";
import { setupUserOrgTuples } from "../helpers/fga";

let seed: SeedOrgResult;
let memberUser: { id: string; token: string };

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

	const member = await seedUser(seed.org.id, seed.roles.developer.id);
	memberUser = member;
	setupUserOrgTuples(member.id, seed.org.id, {
		can_view: true,
		can_edit: true,
	});
});

describe("GET /api/team", () => {
	test("returns empty teams list", async () => {
		const res = await testRequest("/api/team", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
	});
});

describe("POST /api/team", () => {
	test("master can create a team", async () => {
		const res = await testRequest("/api/team", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "Backend Team",
				description: "Backend developers",
				color: "#FF5733",
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; name: string }>();
		expect(body.id).toBeDefined();
		expect(body.name).toBe("Backend Team");
	});

	test("member without can_manage_users gets 403", async () => {
		const res = await testRequest("/api/team", {
			method: "POST",
			token: memberUser.token,
			body: {
				name: "Forbidden Team",
				description: "Should fail",
				color: "#000000",
			},
		});
		expect(res.status).toBe(403);
	});
});

describe("GET /api/team/:id", () => {
	test("returns team with members", async () => {
		// Create a team first
		const createRes = await testRequest("/api/team", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Detail Team", description: "Test", color: "#123456" },
		});
		const { id } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/team/${id}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; name: string; members: any[] }>();
		expect(body.id).toBe(id);
		expect(body.members).toBeArray();
	});
});

describe("POST /api/team/:id/members", () => {
	test("adds a member to a team", async () => {
		// Create team
		const createRes = await testRequest("/api/team", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Member Team", description: "Test", color: "#AABBCC" },
		});
		const { id: teamId } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/team/${teamId}/members`, {
			method: "POST",
			token: seed.masterUser.token,
			body: { user_id: memberUser.id },
		});
		expect(res.status).toBe(201);
	});
});

describe("DELETE /api/team/:id/members/:user_id", () => {
	test("removes a member from a team", async () => {
		// Create team and add member
		const createRes = await testRequest("/api/team", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Remove Team", description: "Test", color: "#DDEEFF" },
		});
		const { id: teamId } = await createRes.json<{ id: string }>();

		await testRequest(`/api/team/${teamId}/members`, {
			method: "POST",
			token: seed.masterUser.token,
			body: { user_id: memberUser.id },
		});

		const res = await testRequest(`/api/team/${teamId}/members/${memberUser.id}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});
});

describe("DELETE /api/team/:id", () => {
	test("master can delete a team", async () => {
		const createRes = await testRequest("/api/team", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Delete Team", description: "Test", color: "#FF00FF" },
		});
		const { id } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/team/${id}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});
});

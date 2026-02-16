/**
 * E2E: Team flow — create team → add members → remove → delete
 *
 * Tests team CRUD with real PostgreSQL and OpenFGA.
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
let memberUser: { id: string; token: string };

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	memberUser = await seedE2EUser(seed.org.id, seed.roles.developer.id);
	await setupE2EUserPermissions(memberUser.id, seed.org.id, {
		can_view: true,
		can_edit: true,
	});
});

describe("Team Flow E2E", () => {
	let teamId: string;

	test("master creates a team", async () => {
		const res = await testRequest("/api/team", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "E2E Backend Team",
				description: "Backend developers",
				color: "#FF5733",
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; name: string }>();
		expect(body.id).toBeDefined();
		expect(body.name).toBe("E2E Backend Team");
		teamId = body.id;
	});

	test("member cannot create teams (no can_manage_users)", async () => {
		const res = await testRequest("/api/team", {
			method: "POST",
			token: memberUser.token,
			body: {
				name: "Should Fail",
				description: "Forbidden",
				color: "#000000",
			},
		});
		expect(res.status).toBe(403);
	});

	test("list teams includes the created team", async () => {
		const res = await testRequest("/api/team", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body.some((t: any) => t.id === teamId)).toBe(true);
	});

	test("add member to team", async () => {
		const res = await testRequest(`/api/team/${teamId}/members`, {
			method: "POST",
			token: seed.masterUser.token,
			body: { user_id: memberUser.id },
		});
		expect(res.status).toBe(201);
	});

	test("get team shows member", async () => {
		const res = await testRequest(`/api/team/${teamId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; members: any[] }>();
		expect(body.members).toBeArray();
		expect(body.members.length).toBeGreaterThan(0);
	});

	test("remove member from team", async () => {
		const res = await testRequest(`/api/team/${teamId}/members/${memberUser.id}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});

	test("delete team", async () => {
		const res = await testRequest(`/api/team/${teamId}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});
});

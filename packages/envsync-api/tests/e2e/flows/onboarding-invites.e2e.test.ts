/**
 * E2E: Onboarding invites — org invite + user invite CRUD
 *
 * Uses real SpacetimeDB and Keycloak.
 * Note: We skip the acceptance flow because acceptOrgInvite calls
 * createKeycloakUser() which is not mocked in E2E.
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

	viewerUser = await seedE2EUser(seed.org.id, seed.roles.viewer.id);
	await setupE2EUserPermissions(viewerUser.id, seed.org.id, { can_view: true });
});

describe("Onboarding Invites E2E", () => {
	let orgInviteCode: string;
	let userInviteCode: string;
	let userInviteId: string;

	test("create org invite", async () => {
		const uniqueEmail = `org-invite-${Date.now()}@test.local`;
		const res = await testRequest("/api/onboarding/org", {
			method: "POST",
			body: { email: uniqueEmail },
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBeDefined();
	});

	test("create user invite", async () => {
		const res = await testRequest("/api/onboarding/user", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				email: "user-invite-e2e@test.local",
				role_id: seed.roles.developer.id,
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBeDefined();
	});

	test("list user invites", async () => {
		const res = await testRequest("/api/onboarding/user", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ invites: any[] }>();
		expect(body.invites).toBeArray();
		expect(body.invites.length).toBeGreaterThan(0);

		// Capture invite code and id for subsequent tests
		const invite = body.invites.find(
			(i: any) => i.email === "user-invite-e2e@test.local",
		);
		expect(invite).toBeDefined();
		userInviteCode = invite.invite_token;
		userInviteId = invite.id;
	});

	test("get user invite by code", async () => {
		const res = await testRequest(
			`/api/onboarding/user/${userInviteCode}`,
			{},
		);
		expect(res.status).toBe(200);

		const body = await res.json<{ invite: { email: string } }>();
		expect(body.invite).toBeDefined();
		expect(body.invite.email).toBe("user-invite-e2e@test.local");
	});

	test("update user invite", async () => {
		const res = await testRequest(
			`/api/onboarding/user/${userInviteCode}`,
			{
				method: "PATCH",
				token: seed.masterUser.token,
				body: { role_id: seed.roles.viewer.id },
			},
		);
		expect(res.status).toBe(200);
	});

	test("delete user invite", async () => {
		const res = await testRequest(
			`/api/onboarding/user/${userInviteId}`,
			{
				method: "DELETE",
				token: seed.masterUser.token,
			},
		);
		expect(res.status).toBe(200);
	});

	test("viewer cannot create invite (403)", async () => {
		const res = await testRequest("/api/onboarding/user", {
			method: "POST",
			token: viewerUser.token,
			body: {
				email: "should-fail@test.local",
				role_id: seed.roles.viewer.id,
			},
		});
		expect(res.status).toBe(403);
	});
});

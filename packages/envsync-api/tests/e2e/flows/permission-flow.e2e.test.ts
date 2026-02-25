/**
 * E2E: Permission flow — tests RBAC enforcement with real SpacetimeDB.
 *
 * Flow: master creates app → member gets 403 → admin grants access →
 *       member succeeds → admin revokes → member gets 403 again.
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
let appId: string;

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	// Create a member with basic permissions (can_view + can_edit only)
	memberUser = await seedE2EUser(seed.org.id, seed.roles.developer.id);
	await setupE2EUserPermissions(memberUser.id, seed.org.id, {
		can_view: true,
		can_edit: true,
	});

	// Master creates an app
	const appRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "Permission Test App", description: "For RBAC E2E" },
	});
	const appBody = await appRes.json<{ id: string }>();
	appId = appBody.id;
});

describe("Permission Flow E2E", () => {
	test("member cannot create apps (no can_manage_apps)", async () => {
		const res = await testRequest("/api/app", {
			method: "POST",
			token: memberUser.token,
			body: { name: "Should Fail", description: "Forbidden" },
		});
		expect(res.status).toBe(403);
	});

	test("master can view own permissions", async () => {
		const res = await testRequest("/api/permission/me", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<Record<string, boolean>>();
		expect(body.is_master).toBe(true);
		expect(body.is_admin).toBe(true);
		expect(body.can_view).toBe(true);
		expect(body.can_edit).toBe(true);
	});

	test("member has limited permissions", async () => {
		const res = await testRequest("/api/permission/me", {
			token: memberUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<Record<string, boolean>>();
		expect(body.can_view).toBe(true);
		expect(body.can_edit).toBe(true);
		expect(body.is_master).toBe(false);
		expect(body.is_admin).toBe(false);
	});

	test("master grants app viewer access to member", async () => {
		const res = await testRequest(`/api/permission/app/${appId}/grant`, {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				subject_type: "user",
				subject_id: memberUser.id,
				relation: "viewer",
			},
		});
		expect(res.status).toBe(200);
	});

	test("master revokes app access from member", async () => {
		const res = await testRequest(`/api/permission/app/${appId}/revoke`, {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				subject_type: "user",
				subject_id: memberUser.id,
				relation: "viewer",
			},
		});
		expect(res.status).toBe(200);
	});

	test("member without can_manage_apps cannot grant app permissions", async () => {
		const res = await testRequest(`/api/permission/app/${appId}/grant`, {
			method: "POST",
			token: memberUser.token,
			body: {
				subject_type: "user",
				subject_id: memberUser.id,
				relation: "viewer",
			},
		});
		expect(res.status).toBe(403);
	});
});

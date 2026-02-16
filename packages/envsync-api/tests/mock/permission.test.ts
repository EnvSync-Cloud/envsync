import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { seedOrg, seedUser, seedApp, type SeedOrgResult } from "../helpers/db";
import { MockFGAClient, setupUserOrgTuples } from "../helpers/fga";

let seed: SeedOrgResult;
let memberUser: { id: string; token: string };
let appId: string;

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

	const app = await seedApp(seed.org.id);
	appId = app.id;

	// Write app->org FGA tuple
	await MockFGAClient.writeTuples([
		{ user: `org:${seed.org.id}`, relation: "org", object: `app:${appId}` },
	]);
});

describe("GET /api/permission/me", () => {
	test("returns effective permissions for master", async () => {
		const res = await testRequest("/api/permission/me", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<Record<string, boolean>>();
		expect(body.can_view).toBe(true);
		expect(body.can_edit).toBe(true);
		expect(body.is_master).toBe(true);
		expect(body.is_admin).toBe(true);
	});

	test("returns limited permissions for member", async () => {
		const res = await testRequest("/api/permission/me", {
			token: memberUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<Record<string, boolean>>();
		expect(body.can_view).toBe(true);
		expect(body.can_edit).toBe(true);
		expect(body.is_master).toBe(false);
	});
});

describe("POST /api/permission/app/:app_id/grant", () => {
	test("grants app viewer access to member", async () => {
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

	test("member without can_manage_apps gets 403", async () => {
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

describe("POST /api/permission/app/:app_id/revoke", () => {
	test("revokes app access from member", async () => {
		// First grant, then revoke
		await testRequest(`/api/permission/app/${appId}/grant`, {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				subject_type: "user",
				subject_id: memberUser.id,
				relation: "editor",
			},
		});

		const res = await testRequest(`/api/permission/app/${appId}/revoke`, {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				subject_type: "user",
				subject_id: memberUser.id,
				relation: "editor",
			},
		});
		expect(res.status).toBe(200);
	});
});

/**
 * E2E: Env type-level permission grant/revoke.
 *
 * Tests RBAC enforcement for env_type-level permission operations.
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
} from "../helpers/real-auth";

let seed: E2ESeed;
let memberUser: { id: string; token: string };
let appId: string;
let envTypeId: string;

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
		body: { name: "EnvType Permission App", description: "For env_type permission E2E" },
	});
	const appBody = await appRes.json<{ id: string }>();
	appId = appBody.id;

	// Create env type
	const envTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "perm-staging", app_id: appId },
	});
	const envTypeBody = await envTypeRes.json<{ id: string }>();
	envTypeId = envTypeBody.id;
});

describe("Env Type Permission E2E", () => {
	test("master grants env_type viewer access to member", async () => {
		const res = await testRequest(`/api/permission/env_type/${envTypeId}/grant`, {
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

	test("master revokes env_type access from member", async () => {
		const res = await testRequest(`/api/permission/env_type/${envTypeId}/revoke`, {
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

	test("member without can_manage_apps cannot grant env_type permissions", async () => {
		const res = await testRequest(`/api/permission/env_type/${envTypeId}/grant`, {
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

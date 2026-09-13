/**
 * E2E: Org management — get → check slug → update → verify
 *
 * Uses real PostgreSQL and OpenFGA.
 * can_manage_org_settings is admin ∪ master (K8). e2e-setup writes authorizationModelDef;
 * existing installs with a pinned OPENFGA_MODEL_ID stay master-only until cli init rewrites it.
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
let adminUser: { id: string; token: string };

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	viewerUser = await seedE2EUser(seed.org.id, seed.roles.viewer.id);
	await setupE2EUserPermissions(viewerUser.id, seed.org.id, { can_view: true });

	adminUser = await seedE2EUser(seed.org.id, seed.roles.developer.id);
	await setupE2EUserPermissions(adminUser.id, seed.org.id, {
		is_admin: true,
		can_view: true,
		can_edit: true,
	});
});

describe("Org Management E2E", () => {
	test("get current org", async () => {
		const res = await testRequest("/api/org", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; name: string; slug: string }>();
		expect(body.id).toBe(seed.org.id);
		expect(body.slug).toBe(seed.org.slug);
	});

	test("check slug (taken)", async () => {
		const res = await testRequest("/api/org/check-slug", {
			token: seed.masterUser.token,
			query: { slug: seed.org.slug },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ exists: boolean }>();
		expect(body.exists).toBe(true);
	});

	test("check slug (available)", async () => {
		const res = await testRequest("/api/org/check-slug", {
			token: seed.masterUser.token,
			query: { slug: "nonexistent-slug-e2e-xyz" },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ exists: boolean }>();
		expect(body.exists).toBe(false);
	});

	test("master updates org", async () => {
		const res = await testRequest("/api/org", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { name: "E2E Updated Org" },
		});
		expect(res.status).toBe(200);
	});

	test("verify org update", async () => {
		const res = await testRequest("/api/org", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ name: string }>();
		expect(body.name).toBe("E2E Updated Org");
	});

	test("org admin (not master) can update org", async () => {
		const me = await testRequest("/api/permission/me", {
			token: adminUser.token,
		});
		expect(me.status).toBe(200);
		const permissions = await me.json<{
			is_admin: boolean;
			is_master: boolean;
			can_manage_org_settings: boolean;
		}>();
		expect(permissions.is_admin).toBe(true);
		expect(permissions.is_master).toBe(false);
		expect(permissions.can_manage_org_settings).toBe(true);

		const res = await testRequest("/api/org", {
			method: "PATCH",
			token: adminUser.token,
			body: { name: "E2E Admin Updated Org" },
		});
		expect(res.status).toBe(200);
	});

	test("viewer cannot update org (403)", async () => {
		const res = await testRequest("/api/org", {
			method: "PATCH",
			token: viewerUser.token,
			body: { name: "Should Fail" },
		});
		expect(res.status).toBe(403);
	});
});

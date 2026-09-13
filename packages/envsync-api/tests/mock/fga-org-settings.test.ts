/**
 * Mock hierarchy matches model.ts. There is no pinned OpenFGA fixture in-repo;
 * e2e-setup writes authorizationModelDef. Real admin∪master coverage is in
 * tests/e2e/flows/org-management.e2e.test.ts (org admin PATCH /api/org).
 */
import { beforeEach, describe, expect, test } from "bun:test";

import { MockFGAClient, resetFGA, setupUserOrgTuples } from "../helpers/fga";

describe("can_manage_org_settings", () => {
	beforeEach(() => {
		resetFGA();
	});

	test("admin can manage org settings", async () => {
		setupUserOrgTuples("admin-1", "org-1", { is_admin: true });
		expect(await MockFGAClient.check("user:admin-1", "can_manage_org_settings", "org:org-1")).toBe(true);
	});

	test("master can manage org settings", async () => {
		setupUserOrgTuples("master-1", "org-1", { is_master: true });
		expect(await MockFGAClient.check("user:master-1", "can_manage_org_settings", "org:org-1")).toBe(true);
	});

	test("member cannot manage org settings", async () => {
		setupUserOrgTuples("dev-1", "org-1", { can_edit: true, can_view: true });
		expect(await MockFGAClient.check("user:dev-1", "can_manage_org_settings", "org:org-1")).toBe(false);
	});
});

/**
 * E2E: Hosted create-organization channel + removed create-workspace + selfhost deny.
 *
 * Uses real Keycloak JWTs as cookie sessions (dashboard channel requires access_token cookie).
 */
import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../../helpers/request";
import { checkServiceHealth, seedE2EOrg, type E2ESeed } from "../helpers/real-auth";
import { EditionPolicyService } from "@/services/edition-policy.service";

let seed: E2ESeed;

function dashboardSessionHeaders(token: string, activeMembershipUserId: string) {
	const csrf = "e2e-create-org-csrf";
	return {
		Cookie: [
			`access_token=${token}`,
			`envsync_active_membership=${activeMembershipUserId}`,
			`envsync_csrf=${csrf}`,
		].join("; "),
		"X-CSRF-Token": csrf,
		"Content-Type": "application/json",
	};
}

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();
});

afterEach(() => {
	EditionPolicyService.clearTestOverrides();
});

describe("Create organization channel E2E", () => {
	test("POST /api/auth/create-workspace is gone (404)", async () => {
		const res = await testRequest("/api/auth/create-workspace", {
			method: "POST",
			headers: dashboardSessionHeaders(seed.masterUser.token, seed.masterUser.id),
			body: { name: "Should Not Exist" },
		});
		expect(res.status).toBe(404);
	});

	test("hosted cookie session can create an organization", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "hosted",
			single_org_mode: false,
		});

		const name = `E2E Hosted Org ${Date.now()}`;
		const res = await testRequest("/api/auth/create-organization", {
			method: "POST",
			headers: dashboardSessionHeaders(seed.masterUser.token, seed.masterUser.id),
			body: { name },
		});

		expect(res.status).toBe(200);
		const body = await res.json<{
			org: { id: string; name: string; slug: string };
			user: { id: string; org_id: string };
			memberships: Array<{ org_id: string }>;
			active_membership_user_id: string;
			can_create_organization?: boolean;
		}>();

		expect(body.org.name).toBe(name);
		expect(body.org.id).toBeTruthy();
		expect(body.user.org_id).toBe(body.org.id);
		expect(body.active_membership_user_id).toBe(body.user.id);
		expect(body.memberships.length).toBeGreaterThanOrEqual(2);
		expect(body.memberships.some(m => m.org_id === body.org.id)).toBe(true);
	});

	test("selfhosted cookie session cannot create an organization via dashboard", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
			max_orgs: 10,
		});

		const res = await testRequest("/api/auth/create-organization", {
			method: "POST",
			headers: dashboardSessionHeaders(seed.masterUser.token, seed.masterUser.id),
			body: { name: "Selfhost Should Fail" },
		});

		expect(res.status).toBe(403);
		const body = await res.json<{ code?: string }>();
		expect(body.code).toBe("ORG_CREATE_CHANNEL_FORBIDDEN");
	});

	test("bearer-only auth cannot use dashboard create-organization (cookie required)", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "hosted",
			single_org_mode: false,
		});

		const res = await testRequest("/api/auth/create-organization", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Bearer Only Should Fail" },
		});

		expect(res.status).toBe(401);
		const body = await res.json<{ code?: string }>();
		expect(body.code).toBe("AUTH_COOKIE_SESSION_REQUIRED");
	});
});

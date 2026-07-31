import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { cleanupDB, seedOrg, type SeedOrgResult } from "../helpers/db";
import { createTestApiKey } from "../helpers/auth";
import { resetFGA, setupUserOrgTuples } from "../helpers/fga";
import { resetVaultStore } from "../helpers/kms";
import { DB } from "@/libs/db";
import { EditionPolicyService } from "@/services/edition-policy.service";

mock.module("@/helpers/jwt", () => ({
	verifyJWTToken: async (token: string) => {
		const sub = token.replace("test-token-", "");
		return { sub, iss: "http://localhost:8080", aud: "test" };
	},
}));

function sessionCookie(token: string, activeMembershipUserId?: string) {
	const parts = [`access_token=${token}`];
	if (activeMembershipUserId) {
		parts.push(`envsync_active_membership=${activeMembershipUserId}`);
	}
	return parts.join("; ");
}

async function seedAuthOrg() {
	const seed = await seedOrg();
	setupUserOrgTuples(seed.masterUser.id, seed.org.id, {
		is_master: true,
		is_admin: true,
		can_view: true,
		can_edit: true,
		have_api_access: true,
		have_billing_options: true,
		have_webhook_access: true,
	});
	return seed;
}

async function createSharedMembership(
	primarySeed: SeedOrgResult,
	targetSeed: SeedOrgResult,
	options?: {
		id?: string;
		email?: string;
		roleId?: string;
		roleTuples?: Parameters<typeof setupUserOrgTuples>[2];
		timestamps?: {
			created_at?: Date;
			updated_at?: Date;
			last_login?: Date | null;
		};
	},
) {
	const db = await DB.getInstance();
	const membershipId = options?.id ?? randomUUID();
	await db
		.insertInto("users")
		.values({
			id: membershipId,
			email: options?.email ?? `shared-${membershipId}@test.local`,
			org_id: targetSeed.org.id,
			role_id: options?.roleId ?? targetSeed.roles.master.id,
			auth_service_id: primarySeed.masterUser.authServiceId,
			full_name: "Shared Membership",
			is_active: true,
			created_at: options?.timestamps?.created_at ?? new Date(),
			updated_at: options?.timestamps?.updated_at ?? new Date(),
			last_login: options?.timestamps?.last_login ?? null,
		})
		.execute();

	setupUserOrgTuples(
		membershipId,
		targetSeed.org.id,
		options?.roleTuples ?? {
			is_master: true,
			is_admin: true,
			can_view: true,
			can_edit: true,
			have_api_access: true,
			have_billing_options: true,
			have_webhook_access: true,
		},
	);

	return membershipId;
}

beforeEach(async () => {
	await cleanupDB();
	resetFGA();
});

afterEach(() => {
	resetVaultStore();
	EditionPolicyService.clearTestOverrides();
});

describe("GET /api/auth/me", () => {
	test("returns 401 without any auth token", async () => {
		const res = await testRequest("/api/auth/me");
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBeDefined();
	});

	test("returns 401 with an invalid token (unknown user)", async () => {
		const res = await testRequest("/api/auth/me", {
			token: "test-token-nonexistent-user",
		});
		expect(res.status).toBe(401);
	});

	test("returns 200 with valid token and user info", async () => {
		const seed = await seedAuthOrg();
		const res = await testRequest("/api/auth/me", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			user: { id: string; email: string; org_id: string };
			org: { id: string; name: string; slug: string };
			role: { id: string; name: string };
			memberships: Array<{ user_id: string; org_id: string; is_active: boolean }>;
			active_membership_user_id: string;
		}>();

		expect(body.user).toBeDefined();
		expect(body.user.id).toBe(seed.masterUser.id);
		expect(body.user.email).toBe(seed.masterUser.email);
		expect(body.user.org_id).toBe(seed.org.id);

		expect(body.org).toBeDefined();
		expect(body.org.id).toBe(seed.org.id);
		expect(body.org.name).toBe(seed.org.name);

		expect(body.role).toBeDefined();
		expect(body.role.id).toBe(seed.roles.master.id);
		expect(body.memberships).toHaveLength(1);
		expect(body.memberships[0]?.user_id).toBe(seed.masterUser.id);
		expect(body.memberships[0]?.is_active).toBe(true);
		expect(body.active_membership_user_id).toBe(seed.masterUser.id);
	});

	test("returns 200 with valid API key", async () => {
		const seed = await seedAuthOrg();
		const { key } = await createTestApiKey(seed.masterUser.id, seed.org.id);

		const res = await testRequest("/api/auth/me", { apiKey: key });
		expect(res.status).toBe(200);

		const body = await res.json<{
			user: { id: string };
			org: { id: string };
		}>();
		expect(body.user.id).toBe(seed.masterUser.id);
		expect(body.org.id).toBe(seed.org.id);
	});
});

describe("multi-org cookie sessions", () => {
	test("falls back to the default membership when the active membership cookie is invalid", async () => {
		const seed = await seedAuthOrg();
		const secondarySeed = await seedOrg({
			orgName: "Secondary Org",
			orgSlug: "secondary-org",
		});
		const db = await DB.getInstance();
		const secondaryMembershipId = `${secondarySeed.masterUser.id}-shared`;

		await db
			.insertInto("users")
			.values({
				id: secondaryMembershipId,
				email: `shared-fallback-${secondaryMembershipId}@test.local`,
				org_id: secondarySeed.org.id,
				role_id: secondarySeed.roles.developer.id,
				auth_service_id: seed.masterUser.authServiceId,
				full_name: "Shared Membership",
				is_active: true,
				created_at: new Date(Date.now() - 60_000),
				updated_at: new Date(Date.now() - 60_000),
				last_login: new Date(Date.now() - 60_000),
			})
			.execute();

		await db
			.updateTable("users")
			.set({
				last_login: new Date(),
				updated_at: new Date(),
			})
			.where("id", "=", seed.masterUser.id)
			.execute();

		const res = await testRequest("/api/auth/me", {
			headers: {
				Cookie: sessionCookie(seed.masterUser.token, "missing-membership"),
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			user: { id: string; org_id: string };
			memberships: Array<{ user_id: string; org_id: string; is_active: boolean }>;
			active_membership_user_id: string;
		}>();

		expect(body.user.id).toBe(seed.masterUser.id);
		expect(body.user.org_id).toBe(seed.org.id);
		expect(body.active_membership_user_id).toBe(seed.masterUser.id);
		expect(body.memberships).toHaveLength(2);
		expect(body.memberships.find(membership => membership.user_id === seed.masterUser.id)?.is_active).toBe(true);
		expect(res.headers.get("set-cookie") ?? "").toContain(`envsync_active_membership=${seed.masterUser.id}`);
	});

	test("switches the active organization for cookie sessions", async () => {
		const seed = await seedAuthOrg();
		const secondarySeed = await seedOrg({
			orgName: "Switch Target Org",
			orgSlug: "switch-target-org",
		});
		const db = await DB.getInstance();
		const targetMembershipId = `${secondarySeed.masterUser.id}-shared`;

		await db
			.insertInto("users")
			.values({
				id: targetMembershipId,
				email: `shared-switch-${targetMembershipId}@test.local`,
				org_id: secondarySeed.org.id,
				role_id: secondarySeed.roles.master.id,
				auth_service_id: seed.masterUser.authServiceId,
				full_name: "Switchable Membership",
				is_active: true,
				created_at: new Date(Date.now() - 30_000),
				updated_at: new Date(Date.now() - 30_000),
			})
			.execute();

		const switchRes = await testRequest("/api/auth/switch-org", {
			method: "POST",
			headers: {
				Cookie: sessionCookie(seed.masterUser.token, seed.masterUser.id),
				"X-CSRF-Token": "test-csrf-token",
			},
			body: {
				org_id: secondarySeed.org.id,
			},
		});

		expect(switchRes.status).toBe(200);
		const switchBody = await switchRes.json<{
			user: { id: string; org_id: string; role_id: string };
			org: { id: string; name: string };
			memberships: Array<{ user_id: string; org_id: string; is_active: boolean }>;
			active_membership_user_id: string;
		}>();

		expect(switchBody.user.id).toBe(targetMembershipId);
		expect(switchBody.user.org_id).toBe(secondarySeed.org.id);
		expect(switchBody.org.id).toBe(secondarySeed.org.id);
		expect(switchBody.active_membership_user_id).toBe(targetMembershipId);
		expect(switchBody.memberships.find(membership => membership.user_id === targetMembershipId)?.is_active).toBe(true);
		expect(switchRes.headers.get("set-cookie") ?? "").toContain(`envsync_active_membership=${targetMembershipId}`);

		const whoAmIRes = await testRequest("/api/auth/me", {
			headers: {
				Cookie: sessionCookie(seed.masterUser.token, targetMembershipId),
			},
		});
		expect(whoAmIRes.status).toBe(200);
		const whoAmIBody = await whoAmIRes.json<{ user: { id: string; org_id: string } }>();
		expect(whoAmIBody.user.id).toBe(targetMembershipId);
		expect(whoAmIBody.user.org_id).toBe(secondarySeed.org.id);
	});

	test("creates a new workspace for the current enterprise identity and switches into it", async () => {
		EditionPolicyService.setTestOverrides({ edition: "enterprise", single_org_mode: false });

		const seed = await seedAuthOrg();
		const createRes = await testRequest("/api/auth/create-workspace", {
			method: "POST",
			headers: {
				Cookie: sessionCookie(seed.masterUser.token, seed.masterUser.id),
				"X-CSRF-Token": "test-csrf-token",
			},
			body: {
				name: "Acme Platform",
			},
		});

		expect(createRes.status).toBe(200);
		const createBody = await createRes.json<{
			user: { id: string; email: string; org_id: string; role_id: string };
			org: { id: string; name: string; slug: string };
			role: { name: string; is_admin: boolean; is_master: boolean };
			memberships: Array<{ user_id: string; org_id: string; org_name: string; is_active: boolean }>;
			active_membership_user_id: string;
		}>();

		expect(createBody.user.id).not.toBe(seed.masterUser.id);
		expect(createBody.user.email).toBe(seed.masterUser.email);
		expect(createBody.org.name).toBe("Acme Platform");
		expect(createBody.org.slug).toBe("acme-platform");
		expect(createBody.role.name).toBe("Org Admin");
		expect(createBody.role.is_admin).toBe(true);
		expect(createBody.active_membership_user_id).toBe(createBody.user.id);
		expect(createBody.memberships).toHaveLength(2);
		expect(createBody.memberships.find(membership => membership.user_id === createBody.user.id)?.is_active).toBe(true);
		expect(createRes.headers.get("set-cookie") ?? "").toContain(`envsync_active_membership=${createBody.user.id}`);

		const db = await DB.getInstance();
		const memberships = await db
			.selectFrom("users")
			.select(["id", "email", "org_id", "auth_service_id"])
			.where("auth_service_id", "=", seed.masterUser.authServiceId)
			.orderBy("created_at", "asc")
			.execute();

		expect(memberships).toHaveLength(2);
		expect(memberships.every(membership => membership.email === seed.masterUser.email)).toBe(true);
		expect(memberships.some(membership => membership.org_id === createBody.org.id)).toBe(true);

		const whoAmIRes = await testRequest("/api/auth/me", {
			headers: {
				Cookie: sessionCookie(seed.masterUser.token, createBody.user.id),
			},
		});
		expect(whoAmIRes.status).toBe(200);
		const whoAmIBody = await whoAmIRes.json<{ user: { id: string; org_id: string }; org: { id: string } }>();
		expect(whoAmIBody.user.id).toBe(createBody.user.id);
		expect(whoAmIBody.user.org_id).toBe(createBody.org.id);
		expect(whoAmIBody.org.id).toBe(createBody.org.id);
	});

	test("rejects workspace creation on selfhosted deployments", async () => {
		EditionPolicyService.setTestOverrides({
			edition: "enterprise",
			deployment_mode: "selfhosted",
		});
		const seed = await seedAuthOrg();

		const createRes = await testRequest("/api/auth/create-workspace", {
			method: "POST",
			headers: {
				Cookie: sessionCookie(seed.masterUser.token, seed.masterUser.id),
				"X-CSRF-Token": "test-csrf-token",
			},
			body: {
				name: "Should Fail",
			},
		});

		expect(createRes.status).toBe(403);
		const body = await createRes.json<{ code?: string }>();
		expect(body.code).toBe("ORG_CREATE_CHANNEL_FORBIDDEN");
	});

	test("rejects workspace creation on oss (selfhosted) editions", async () => {
		EditionPolicyService.setTestOverrides({ edition: "oss", deployment_mode: "selfhosted" });
		const seed = await seedAuthOrg();

		const createRes = await testRequest("/api/auth/create-workspace", {
			method: "POST",
			headers: {
				Cookie: sessionCookie(seed.masterUser.token, seed.masterUser.id),
				"X-CSRF-Token": "test-csrf-token",
			},
			body: {
				name: "Should Fail",
			},
		});

		expect(createRes.status).toBe(403);
		const body = await createRes.json<{ code?: string }>();
		expect(body.code).toBe("ORG_CREATE_CHANNEL_FORBIDDEN");
	});
});

describe("multi-org bearer token selection", () => {
	test("selects the requested membership for bearer token requests", async () => {
		const seed = await seedAuthOrg();
		const secondarySeed = await seedOrg({
			orgName: "Bearer Target Org",
			orgSlug: "bearer-target-org",
		});
		const secondaryMembershipId = await createSharedMembership(seed, secondarySeed, {
			timestamps: {
				created_at: new Date(Date.now() - 60_000),
				updated_at: new Date(Date.now() - 60_000),
				last_login: new Date(Date.now() - 60_000),
			},
		});

		const primaryRes = await testRequest("/api/auth/me", {
			token: seed.masterUser.token,
			headers: {
				"X-EnvSync-Org-Id": seed.org.id,
			},
		});
		expect(primaryRes.status).toBe(200);
		const primaryBody = await primaryRes.json<{
			user: { id: string; org_id: string };
			org: { id: string };
			active_membership_user_id: string;
		}>();
		expect(primaryBody.user.id).toBe(seed.masterUser.id);
		expect(primaryBody.user.org_id).toBe(seed.org.id);
		expect(primaryBody.org.id).toBe(seed.org.id);
		expect(primaryBody.active_membership_user_id).toBe(seed.masterUser.id);

		const secondaryRes = await testRequest("/api/auth/me", {
			token: seed.masterUser.token,
			headers: {
				"X-EnvSync-Org-Id": secondarySeed.org.id,
			},
		});
		expect(secondaryRes.status).toBe(200);
		const secondaryBody = await secondaryRes.json<{
			user: { id: string; org_id: string };
			org: { id: string };
			active_membership_user_id: string;
		}>();
		expect(secondaryBody.user.id).toBe(secondaryMembershipId);
		expect(secondaryBody.user.org_id).toBe(secondarySeed.org.id);
		expect(secondaryBody.org.id).toBe(secondarySeed.org.id);
		expect(secondaryBody.active_membership_user_id).toBe(secondaryMembershipId);
	});

	test("returns 403 when the bearer token identity does not belong to the requested org", async () => {
		const seed = await seedAuthOrg();
		const res = await testRequest("/api/auth/me", {
			token: seed.masterUser.token,
			headers: {
				"X-EnvSync-Org-Id": "missing-org",
			},
		});

		expect(res.status).toBe(403);
		const body = await res.json<{ code?: string }>();
		expect(body.code).toBe("AUTH_ORG_MEMBERSHIP_REQUIRED");
	});

	test("returns 400 for blank bearer token org headers", async () => {
		const seed = await seedAuthOrg();
		const res = await testRequest("/api/auth/me", {
			token: seed.masterUser.token,
			headers: {
				"X-EnvSync-Org-Id": "   ",
			},
		});

		expect(res.status).toBe(400);
		const body = await res.json<{ code?: string }>();
		expect(body.code).toBe("AUTH_ORG_HEADER_INVALID");
	});

	test("keeps the existing default membership resolution when the bearer token org header is absent", async () => {
		const seed = await seedAuthOrg();
		const secondarySeed = await seedOrg({
			orgName: "Fallback Org",
			orgSlug: "fallback-org",
		});
		await createSharedMembership(seed, secondarySeed, {
			timestamps: {
				created_at: new Date(Date.now() - 60_000),
				updated_at: new Date(Date.now() - 60_000),
				last_login: new Date(Date.now() - 60_000),
			},
		});
		const db = await DB.getInstance();
		await db
			.updateTable("users")
			.set({
				last_login: new Date(),
				updated_at: new Date(),
			})
			.where("id", "=", seed.masterUser.id)
			.execute();

		const res = await testRequest("/api/auth/me", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			user: { id: string; org_id: string };
			active_membership_user_id: string;
		}>();
		expect(body.user.id).toBe(seed.masterUser.id);
		expect(body.user.org_id).toBe(seed.org.id);
		expect(body.active_membership_user_id).toBe(seed.masterUser.id);
	});

	test("ignores the header for cookie sessions", async () => {
		const seed = await seedAuthOrg();
		const secondarySeed = await seedOrg({
			orgName: "Cookie Target Org",
			orgSlug: "cookie-target-org",
		});
		const secondaryMembershipId = await createSharedMembership(seed, secondarySeed);

		const res = await testRequest("/api/auth/me", {
			headers: {
				Cookie: sessionCookie(seed.masterUser.token, secondaryMembershipId),
				"X-EnvSync-Org-Id": seed.org.id,
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			user: { id: string; org_id: string };
			active_membership_user_id: string;
		}>();
		expect(body.user.id).toBe(secondaryMembershipId);
		expect(body.user.org_id).toBe(secondarySeed.org.id);
		expect(body.active_membership_user_id).toBe(secondaryMembershipId);
	});

	test("ignores the header for api key requests", async () => {
		const seed = await seedAuthOrg();
		const secondarySeed = await seedOrg({
			orgName: "API Key Org",
			orgSlug: "api-key-org",
		});
		await createSharedMembership(seed, secondarySeed);
		const { key } = await createTestApiKey(seed.masterUser.id, seed.org.id);

		const res = await testRequest("/api/auth/me", {
			apiKey: key,
			headers: {
				"X-EnvSync-Org-Id": secondarySeed.org.id,
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			user: { id: string; org_id: string };
			org: { id: string };
			active_membership_user_id: string;
		}>();
		expect(body.user.id).toBe(seed.masterUser.id);
		expect(body.user.org_id).toBe(seed.org.id);
		expect(body.org.id).toBe(seed.org.id);
		expect(body.active_membership_user_id).toBe(seed.masterUser.id);
	});

	test("applies bearer org selection on the management surface", async () => {
		const seed = await seedAuthOrg();
		const secondarySeed = await seedOrg({
			orgName: "Management Target Org",
			orgSlug: "management-target-org",
		});
		await createSharedMembership(seed, secondarySeed, {
			timestamps: {
				created_at: new Date(Date.now() - 60_000),
				updated_at: new Date(Date.now() - 60_000),
				last_login: new Date(Date.now() - 60_000),
			},
		});
		const defaultRes = await testRequest("/api/enterprise/providers", {
			surface: "management",
			token: seed.masterUser.token,
		});
		expect(defaultRes.status).toBe(200);
		const defaultBody = await defaultRes.json<{ providers: Array<{ id: string }> }>();
		expect(defaultBody.providers.length).toBeGreaterThan(0);

		const secondaryRes = await testRequest("/api/enterprise/providers", {
			surface: "management",
			token: seed.masterUser.token,
			headers: {
				"X-EnvSync-Org-Id": secondarySeed.org.id,
			},
		});
		expect(secondaryRes.status).toBe(200);
		const secondaryBody = await secondaryRes.json<{ providers: Array<{ id: string }> }>();
		expect(secondaryBody.providers.length).toBe(defaultBody.providers.length);

		const invalidRes = await testRequest("/api/enterprise/providers", {
			surface: "management",
			token: seed.masterUser.token,
			headers: {
				"X-EnvSync-Org-Id": "missing-org",
			},
		});
		expect(invalidRes.status).toBe(403);
		const invalidBody = await invalidRes.json<{ code?: string }>();
		expect(invalidBody.code).toBe("AUTH_ORG_MEMBERSHIP_REQUIRED");
	});
});

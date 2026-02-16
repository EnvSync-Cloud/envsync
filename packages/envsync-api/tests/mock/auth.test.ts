import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { cleanupDB, seedOrg, type SeedOrgResult } from "../helpers/db";
import { createTestApiKey } from "../helpers/auth";
import { resetFGA, setupUserOrgTuples } from "../helpers/fga";
import { resetVault } from "../helpers/vault";

let seed: SeedOrgResult;

beforeAll(async () => {
	seed = await seedOrg();
	// Set up FGA tuples for the master user (Org Admin role)
	setupUserOrgTuples(seed.masterUser.id, seed.org.id, {
		is_master: true,
		is_admin: true,
		can_view: true,
		can_edit: true,
		have_api_access: true,
		have_billing_options: true,
		have_webhook_access: true,
	});
});

afterEach(() => {
	resetVault();
});

describe("GET /api/auth/me", () => {
	test("returns 401 without any auth token", async () => {
		const res = await testRequest("/api/auth/me");
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.error).toBeDefined();
	});

	test("returns 403 with an invalid token (unknown user)", async () => {
		const res = await testRequest("/api/auth/me", {
			token: "test-token-nonexistent-user",
		});
		expect(res.status).toBe(403);
	});

	test("returns 200 with valid token and user info", async () => {
		const res = await testRequest("/api/auth/me", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			user: { id: string; email: string; org_id: string };
			org: { id: string; name: string; slug: string };
			role: { id: string; name: string };
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
	});

	test("returns 200 with valid API key", async () => {
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

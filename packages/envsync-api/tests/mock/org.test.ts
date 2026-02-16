import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { seedOrg, type SeedOrgResult } from "../helpers/db";
import { setupUserOrgTuples } from "../helpers/fga";

let seed: SeedOrgResult;

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
});

describe("GET /api/org", () => {
	test("returns current org details", async () => {
		const res = await testRequest("/api/org", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; name: string; slug: string }>();
		expect(body.id).toBe(seed.org.id);
		expect(body.name).toBe(seed.org.name);
		expect(body.slug).toBe(seed.org.slug);
	});
});

describe("PATCH /api/org", () => {
	test("master can update org name", async () => {
		const res = await testRequest("/api/org", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { name: "Updated Org Name" },
		});
		expect(res.status).toBe(200);
	});

	test("non-master gets 403", async () => {
		// Create a non-master user
		const { seedUser } = await import("../helpers/db");
		const viewer = await seedUser(seed.org.id, seed.roles.viewer.id);
		setupUserOrgTuples(viewer.id, seed.org.id, {
			can_view: true,
		});

		const res = await testRequest("/api/org", {
			method: "PATCH",
			token: viewer.token,
			body: { name: "Should Fail" },
		});
		expect(res.status).toBe(403);
	});
});

describe("GET /api/org/check-slug", () => {
	test("returns availability for existing slug", async () => {
		const res = await testRequest("/api/org/check-slug", {
			token: seed.masterUser.token,
			query: { slug: seed.org.slug },
		});
		expect(res.status).toBe(200);
	});

	test("returns availability for new slug", async () => {
		const res = await testRequest("/api/org/check-slug", {
			token: seed.masterUser.token,
			query: { slug: "totally-new-unique-slug-12345" },
		});
		expect(res.status).toBe(200);
	});
});

import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { seedOrg, seedUser, type SeedOrgResult } from "../helpers/db";
import { setupUserOrgTuples } from "../helpers/fga";

let seed: SeedOrgResult;
let viewerToken: string;

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

	const viewer = await seedUser(seed.org.id, seed.roles.viewer.id);
	viewerToken = viewer.token;
	setupUserOrgTuples(viewer.id, seed.org.id, { can_view: true });
});

describe("POST /api/webhook", () => {
	test("creates a webhook", async () => {
		const res = await testRequest("/api/webhook", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "Test Webhook",
				url: "https://example.com/hook",
				event_types: ["app_created"],
				webhook_type: "CUSTOM",
				linked_to: "org",
			},
		});
		expect(res.status).toBe(201);

		// createWebhook service returns the UUID id string
		const body = await res.text();
		expect(body).toBeDefined();
	});

	test("viewer gets 403 (needs can_manage_webhooks)", async () => {
		const res = await testRequest("/api/webhook", {
			method: "POST",
			token: viewerToken,
			body: {
				name: "Fail Webhook",
				url: "https://example.com/fail",
				event_types: ["app_created"],
				webhook_type: "CUSTOM",
				linked_to: "org",
			},
		});
		expect(res.status).toBe(403);
	});
});

describe("GET /api/webhook", () => {
	test("returns all webhooks for org", async () => {
		const res = await testRequest("/api/webhook", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
	});
});

describe("GET /api/webhook/:id", () => {
	test("returns webhook details", async () => {
		const createRes = await testRequest("/api/webhook", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "Detail Hook",
				url: "https://example.com/detail",
				event_types: ["app_updated"],
				webhook_type: "CUSTOM",
				linked_to: "org",
			},
		});
		// createWebhook returns just the UUID string
		const id = await createRes.json<string>();

		const res = await testRequest(`/api/webhook/${id}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; name: string }>();
		expect(body.id).toBe(id);
	});
});

describe("DELETE /api/webhook/:id", () => {
	test("deletes a webhook", async () => {
		const createRes = await testRequest("/api/webhook", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "Delete Hook",
				url: "https://example.com/delete",
				event_types: ["app_deleted"],
				webhook_type: "CUSTOM",
				linked_to: "org",
			},
		});
		// createWebhook returns just the UUID string
		const id = await createRes.json<string>();

		const res = await testRequest(`/api/webhook/${id}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});
});

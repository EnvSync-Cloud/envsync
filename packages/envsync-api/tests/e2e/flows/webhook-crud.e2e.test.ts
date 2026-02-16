/**
 * E2E: Webhook CRUD — create → list → get → update → delete
 *
 * Uses real PostgreSQL and OpenFGA.
 * Master has have_webhook_access → can_manage_webhooks via FGA model.
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

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	viewerUser = await seedE2EUser(seed.org.id, seed.roles.viewer.id);
	await setupE2EUserPermissions(viewerUser.id, seed.org.id, { can_view: true });
});

describe("Webhook CRUD E2E", () => {
	let webhookId: string;

	test("create CUSTOM webhook", async () => {
		const res = await testRequest("/api/webhook", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "E2E Test Webhook",
				url: "https://hooks.example.com/e2e-webhook",
				event_types: ["env_created", "env_updated"],
				webhook_type: "CUSTOM",
			},
		});
		expect(res.status).toBe(201);

		// createWebhook returns just the UUID string, not an object
		const body = await res.json<string>();
		expect(body).toBeDefined();
		expect(typeof body).toBe("string");
		webhookId = body;
	});

	test("list webhooks", async () => {
		const res = await testRequest("/api/webhook", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		expect(body.some((w: any) => w.id === webhookId)).toBe(true);
	});

	test("get webhook by ID", async () => {
		const res = await testRequest(`/api/webhook/${webhookId}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; name: string; url: string }>();
		expect(body.id).toBe(webhookId);
		expect(body.name).toBe("E2E Test Webhook");
	});

	test("update webhook", async () => {
		const res = await testRequest(`/api/webhook/${webhookId}`, {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				url: "https://hooks.example.com/e2e-updated",
				webhook_type: "CUSTOM",
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Webhook updated successfully");
	});

	test("delete webhook", async () => {
		const res = await testRequest(`/api/webhook/${webhookId}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Webhook deleted successfully");
	});

	test("viewer cannot create webhook (403)", async () => {
		const res = await testRequest("/api/webhook", {
			method: "POST",
			token: viewerUser.token,
			body: {
				name: "Should Fail",
				url: "https://hooks.example.com/fail",
				event_types: ["env_created"],
				webhook_type: "CUSTOM",
			},
		});
		expect(res.status).toBe(403);
	});
});

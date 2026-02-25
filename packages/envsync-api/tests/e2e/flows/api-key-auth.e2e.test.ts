/**
 * E2E: API key authentication flow — create key → use it → regenerate → verify
 *
 * Tests API key CRUD and auth with real SpacetimeDB and Keycloak.
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

describe("API Key Auth E2E", () => {
	let apiKeyId: string;
	let apiKey: string;

	test("master creates an API key", async () => {
		const res = await testRequest("/api/api_key", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "E2E Test Key", description: "For E2E auth testing" },
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; key: string }>();
		expect(body.id).toBeDefined();
		expect(body.key).toBeDefined();
		expect(body.key).toStartWith("eVs");
		apiKeyId = body.id;
		apiKey = body.key;
	});

	test("can authenticate with the API key", async () => {
		const res = await testRequest("/api/auth/me", {
			apiKey,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ user: { id: string; email: string } }>();
		expect(body.user.id).toBe(seed.masterUser.id);
	});

	test("viewer cannot create API keys (403)", async () => {
		const res = await testRequest("/api/api_key", {
			method: "POST",
			token: viewerUser.token,
			body: { name: "Should Fail", description: "Forbidden" },
		});
		expect(res.status).toBe(403);
	});

	test("list API keys", async () => {
		const res = await testRequest("/api/api_key", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		expect(body.length).toBeGreaterThan(0);
	});

	test("regenerate API key", async () => {
		const res = await testRequest(`/api/api_key/${apiKeyId}/regenerate`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ newKey: string; id: string }>();
		expect(body.newKey).toBeDefined();
		expect(body.newKey).not.toBe(apiKey);
		apiKey = body.newKey;
	});

	test("new key works for auth", async () => {
		const res = await testRequest("/api/auth/me", {
			apiKey,
		});
		expect(res.status).toBe(200);
	});

	test("delete API key", async () => {
		const res = await testRequest(`/api/api_key/${apiKeyId}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});
});

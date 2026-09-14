import { createHash } from "node:crypto";

import { beforeAll, describe, expect, test } from "bun:test";

import { CacheClient } from "@/libs/cache";
import { CacheKeys } from "@/helpers/cache-keys";
import { ApiKeyService } from "@/services/api_key.service";

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

describe("POST /api/api_key", () => {
	test("creates an API key", async () => {
		const res = await testRequest("/api/api_key", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Test key", description: "Test key" },
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; key: string }>();
		expect(body.id).toBeDefined();
		expect(body.key).toBeDefined();
	});

	test("viewer gets 403 (needs can_manage_api_keys)", async () => {
		const res = await testRequest("/api/api_key", {
			method: "POST",
			token: viewerToken,
			body: { name: "Should fail", description: "Should fail" },
		});
		expect(res.status).toBe(403);
	});
});

describe("GET /api/api_key", () => {
	test("returns all keys for org", async () => {
		const res = await testRequest("/api/api_key", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
	});
});

describe("GET /api/api_key/:id", () => {
	test("returns specific key details", async () => {
		const createRes = await testRequest("/api/api_key", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Detail key", description: "Detail key" },
		});
		const { id } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/api_key/${id}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string }>();
		expect(body.id).toBe(id);
	});
});

describe("API key cache", () => {
	test("looks up by hash and does not store the raw secret", async () => {
		const res = await testRequest("/api/api_key", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Cache key", description: "Cache key" },
		});
		const created = await res.json<{ id: string; key: string }>();
		const hashed = createHash("sha256").update(created.key).digest("hex");

		await ApiKeyService.getKeyByCreds(created.key);

		const rawKey = await CacheClient.get(CacheKeys.apiKeyByHash(created.key));
		expect(rawKey).toBeNull();
		const cached = await CacheClient.get(CacheKeys.apiKeyByHash(hashed));
		expect(cached).toBeTruthy();
		expect(cached).not.toContain(created.key);
		const parsed = JSON.parse(cached as string) as {
			id: string;
			user_id: string;
			org_id: string;
			is_active: boolean;
		};
		expect(parsed.id).toBe(created.id);
		expect(parsed.is_active).toBe(true);
		expect(Object.keys(parsed).sort()).toEqual(["id", "is_active", "org_id", "user_id"]);
	});
});

describe("GET /api/api_key/:id/regenerate", () => {
	test("regenerates an API key", async () => {
		const createRes = await testRequest("/api/api_key", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Regen key", description: "Regen key" },
		});
		const { id, key: oldKey } = await createRes.json<{ id: string; key: string }>();

		const res = await testRequest(`/api/api_key/${id}/regenerate`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ newKey: string }>();
		expect(body.newKey).toBeDefined();
		expect(body.newKey).not.toBe(oldKey);
	});
});

describe("DELETE /api/api_key/:id", () => {
	test("deletes an API key", async () => {
		const createRes = await testRequest("/api/api_key", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Delete key", description: "Delete key" },
		});
		const { id } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/api_key/${id}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});
});

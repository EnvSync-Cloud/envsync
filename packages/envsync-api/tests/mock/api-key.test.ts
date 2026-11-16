import { createHash, randomUUID } from "node:crypto";

import { beforeAll, describe, expect, test } from "bun:test";

import { CacheClient } from "@/libs/cache";
import { DB } from "@/libs/db";
import { CacheKeys } from "@/helpers/cache-keys";
import { ApiKeyService } from "@/services/api_key.service";

import { testRequest } from "../helpers/request";
import { seedOrg, seedUser, type SeedOrgResult } from "../helpers/db";
import { setupUserOrgTuples } from "../helpers/fga";

let seed: SeedOrgResult;
let viewerToken: string;

function digestOf(key: string) {
	return createHash("sha256").update(key).digest("hex");
}

function assertSecretHidden(body: unknown, rawKey: string) {
	const serialized = JSON.stringify(body);
	expect(serialized.includes(rawKey)).toBe(false);
	expect(serialized.includes(digestOf(rawKey))).toBe(false);
}

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

		const body = await res.json<{ id: string; key: string; key_hint: string }>();
		expect(body.id).toBeDefined();
		expect(body.key).toStartWith("eVs");
		expect(body.key_hint).toBe(`${body.key.slice(0, 8)}…`);
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
	test("returns the secret once and hides it on later reads", async () => {
		const createRes = await testRequest("/api/api_key", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Detail key", description: "Detail key" },
		});
		const created = await createRes.json<{ id: string; key: string; key_hint: string }>();
		expect(created.key).toStartWith("eVs");

		const db = await DB.getInstance();
		const stored = await db
			.selectFrom("api_keys")
			.select(["key", "key_hint"])
			.where("id", "=", created.id)
			.executeTakeFirstOrThrow();
		expect(stored.key).toBe(digestOf(created.key));
		expect(stored.key_hint).toBe(created.key_hint);

		const res = await testRequest(`/api/api_key/${created.id}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; key?: string; key_hint: string }>();
		expect(body.id).toBe(created.id);
		expect(body.key).toBeUndefined();
		expect(body.key_hint).toBe(`${created.key.slice(0, 8)}…`);
		assertSecretHidden(body, created.key);

		const listRes = await testRequest("/api/api_key", {
			token: seed.masterUser.token,
		});
		expect(listRes.status).toBe(200);
		const list = await listRes.json<Array<{ id: string; key?: string }>>();
		const listed = list.find(key => key.id === created.id);
		expect(listed).toBeDefined();
		expect(listed?.key).toBeUndefined();
		assertSecretHidden(listed, created.key);
	});
});

describe("API key cache", () => {
	test("looks up credentials without caching the secret", async () => {
		const res = await testRequest("/api/api_key", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Cache key", description: "Cache key" },
		});
		const created = await res.json<{ id: string; key: string }>();

		const lookedUp = await ApiKeyService.getKeyByCreds(created.key);
		expect(lookedUp?.id).toBe(created.id);
		expect(lookedUp?.is_active).toBe(true);

		expect(await CacheClient.get(CacheKeys.apiKeyByHash(created.key))).toBeNull();
		const cached = await CacheClient.get(CacheKeys.apiKeyByHash(digestOf(created.key)));
		expect(cached).not.toBeNull();
		expect(cached).not.toContain(created.key);
	});

	test("getKeyByUserId does not return or cache the raw secret", async () => {
		const res = await testRequest("/api/api_key", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "User list key", description: "User list key" },
		});
		const created = await res.json<{ id: string; key: string }>();
		const listed = await ApiKeyService.getKeyByUserId(seed.masterUser.id);
		expect(listed.some(key => key.id === created.id)).toBe(true);
		expect(listed.every(key => !("key" in key))).toBe(true);
	});
});

describe("API key authentication", () => {
	test("accepts the key and rejects a modified key", async () => {
		const createRes = await testRequest("/api/api_key", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Auth key", description: "Auth key" },
		});
		const created = await createRes.json<{ key: string }>();

		const ok = await testRequest("/api/auth/me", { apiKey: created.key });
		expect(ok.status).toBe(200);

		const bad = await testRequest("/api/auth/me", { apiKey: `${created.key}x` });
		expect(bad.status).toBe(401);
	});

	test("upgrades a plaintext row to a hash after one successful auth", async () => {
		const db = await DB.getInstance();
		const raw = `eVs_legacy_${randomUUID().replace(/-/g, "")}`;
		const id = randomUUID();
		await db
			.insertInto("api_keys")
			.values({
				id,
				org_id: seed.org.id,
				user_id: seed.masterUser.id,
				key: raw,
				description: "Legacy plaintext key",
				is_active: true,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		const before = await testRequest(`/api/api_key/${id}`, {
			token: seed.masterUser.token,
		});
		expect(before.status).toBe(200);
		const beforeBody = await before.json<{ key?: string }>();
		expect(beforeBody.key).toBeUndefined();
		assertSecretHidden(beforeBody, raw);

		const stillPlain = await db
			.selectFrom("api_keys")
			.select(["key"])
			.where("id", "=", id)
			.executeTakeFirstOrThrow();
		expect(stillPlain.key).toBe(raw);

		const authed = await testRequest("/api/auth/me", { apiKey: raw });
		expect(authed.status).toBe(200);

		const stored = await db
			.selectFrom("api_keys")
			.select(["key", "key_hint"])
			.where("id", "=", id)
			.executeTakeFirstOrThrow();
		expect(stored.key).toBe(digestOf(raw));
		expect(stored.key).not.toBe(raw);
		expect(stored.key_hint).toBe(`${raw.slice(0, 8)}…`);

		const again = await testRequest("/api/auth/me", { apiKey: raw });
		expect(again.status).toBe(200);

		const usingHash = await testRequest("/api/auth/me", { apiKey: stored.key });
		expect(usingHash.status).toBe(401);
	});
});

describe("POST /api/api_key/:id/regenerate", () => {
	test("rejects GET and rotates on POST", async () => {
		const createRes = await testRequest("/api/api_key", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Regen key", description: "Regen key" },
		});
		const { id, key: oldKey } = await createRes.json<{ id: string; key: string }>();

		const getRes = await testRequest(`/api/api_key/${id}/regenerate`, {
			token: seed.masterUser.token,
		});
		expect(getRes.status).toBe(404);
		expect((await ApiKeyService.getKeyByCreds(oldKey))?.id).toBe(id);

		const res = await testRequest(`/api/api_key/${id}/regenerate`, {
			method: "POST",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ newKey: string; id: string; key?: string }>();
		expect(body.newKey).toStartWith("eVs");
		expect(body.newKey).not.toBe(oldKey);
		expect(body.key).toBeUndefined();

		expect(await ApiKeyService.getKeyByCreds(oldKey)).toBeNull();
		expect((await ApiKeyService.getKeyByCreds(body.newKey))?.id).toBe(id);

		const read = await testRequest(`/api/api_key/${id}`, {
			token: seed.masterUser.token,
		});
		expect(read.status).toBe(200);
		const readBody = await read.json<{ key?: string }>();
		expect(readBody.key).toBeUndefined();
		assertSecretHidden(readBody, body.newKey);
		assertSecretHidden(readBody, oldKey);
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

import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { getDB, seedApp, seedEnvType, seedOrg, seedUser, type SeedOrgResult } from "../helpers/db";
import { MockFGAClient, setupUserOrgTuples } from "../helpers/fga";
import { resetVaultStore } from "../helpers/kms";
import { ServiceTokenService } from "@/services/service_token.service";

let seed: SeedOrgResult;
let viewerToken: string;
let appId: string;
let envTypeId: string;

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

	const app = await seedApp(seed.org.id);
	appId = app.id;

	const envType = await seedEnvType(seed.org.id, appId);
	envTypeId = envType.id;

	await MockFGAClient.writeTuples([
		{ user: `app:${appId}`, relation: "app", object: `env_type:${envTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `env_type:${envTypeId}` },
		{ user: `org:${seed.org.id}`, relation: "org", object: `app:${appId}` },
	]);
});

afterEach(() => {
	resetVaultStore();
});

async function createServiceToken(body: Record<string, unknown>) {
	const res = await testRequest("/api/service_token", {
		method: "POST",
		token: seed.masterUser.token,
		body,
	});
	expect(res.status).toBe(201);
	return res.json<{
		id: string;
		token: string;
		scopes: Array<{ env_type_id?: string | null; path: string }>;
		rotated_from_id: string | null;
		token_hash?: string;
	}>();
}

describe("POST /api/service_token", () => {
	test("creates a hashed esv_ token and returns the raw value once", async () => {
		const body = await createServiceToken({
			name: "CI token",
			app_id: appId,
			scopes: [{ env_type_id: envTypeId, path: "/" }],
			expires_in_days: 30,
		});

		expect(body.id).toBeDefined();
		expect(body.token).toStartWith("esv_");
		expect(body.token_hash).toBeUndefined();
		expect(body.scopes).toEqual([{ env_type_id: envTypeId, path: "/" }]);
		expect(body.rotated_from_id).toBeNull();

		const fetched = await testRequest(`/api/service_token/${body.id}`, {
			token: seed.masterUser.token,
		});
		expect(fetched.status).toBe(200);
		const fetchedBody = await fetched.json<{ token?: string; token_hash?: string }>();
		expect(fetchedBody.token).toBeUndefined();
		expect(fetchedBody.token_hash).toBeUndefined();
	});

	test("accepts multiple path scopes", async () => {
		const body = await createServiceToken({
			name: "multi-scope",
			scopes: [
				{ env_type_id: envTypeId, path: "/db" },
				{ env_type_id: envTypeId, path: "/cache" },
			],
		});

		expect(body.scopes).toEqual([
			{ env_type_id: envTypeId, path: "/db" },
			{ env_type_id: envTypeId, path: "/cache" },
		]);
	});

	test("viewer gets 403 (needs can_manage_api_keys)", async () => {
		const res = await testRequest("/api/service_token", {
			method: "POST",
			token: viewerToken,
			body: { name: "Should fail" },
		});
		expect(res.status).toBe(403);
	});
});

describe("POST /api/service_token/:id/rotate", () => {
	test("issues a new esv_ token and keeps the previous hash during grace", async () => {
		const created = await createServiceToken({
			name: "rotate-me",
			scopes: [{ env_type_id: envTypeId, path: "/" }],
			permissions: { read: true, write: false },
		});

		const rotateRes = await testRequest(`/api/service_token/${created.id}/rotate`, {
			method: "POST",
			token: seed.masterUser.token,
			body: { grace_hours: 24 },
		});
		expect(rotateRes.status).toBe(201);

		const rotated = await rotateRes.json<{
			id: string;
			token: string;
			rotated_from_id: string | null;
			token_hash?: string;
		}>();
		expect(rotated.id).not.toBe(created.id);
		expect(rotated.token).toStartWith("esv_");
		expect(rotated.token).not.toBe(created.token);
		expect(rotated.rotated_from_id).toBe(created.id);
		expect(rotated.token_hash).toBeUndefined();

		const oldStillValid = await ServiceTokenService.validateTokenByHash(created.token);
		expect(oldStillValid?.id).toBe(created.id);

		const newValid = await ServiceTokenService.validateTokenByHash(rotated.token);
		expect(newValid?.id).toBe(rotated.id);

		const fetched = await testRequest(`/api/service_token/${rotated.id}`, {
			token: seed.masterUser.token,
		});
		const fetchedBody = await fetched.json<{ token?: string; token_hash?: string }>();
		expect(fetchedBody.token).toBeUndefined();
		expect(fetchedBody.token_hash).toBeUndefined();
	});

	test("zero grace immediately invalidates the previous hash", async () => {
		const created = await createServiceToken({
			name: "zero-grace",
			scopes: [{ env_type_id: envTypeId, path: "/" }],
		});

		const rotateRes = await testRequest(`/api/service_token/${created.id}/rotate`, {
			method: "POST",
			token: seed.masterUser.token,
			body: { grace_hours: 0 },
		});
		expect(rotateRes.status).toBe(201);

		const rotated = await rotateRes.json<{ token: string }>();
		expect(await ServiceTokenService.validateTokenByHash(created.token)).toBeNull();
		expect(await ServiceTokenService.validateTokenByHash(rotated.token)).not.toBeNull();
	});

	test("rejects the previous hash after grace_until expires", async () => {
		const created = await createServiceToken({
			name: "expired-grace",
			scopes: [{ env_type_id: envTypeId, path: "/" }],
		});

		const rotateRes = await testRequest(`/api/service_token/${created.id}/rotate`, {
			method: "POST",
			token: seed.masterUser.token,
			body: { grace_hours: 24 },
		});
		expect(rotateRes.status).toBe(201);
		expect(await ServiceTokenService.validateTokenByHash(created.token)).not.toBeNull();

		const db = await getDB();
		await db
			.updateTable("service_tokens")
			.set({ grace_until: new Date(Date.now() - 1000), updated_at: new Date() })
			.where("id", "=", created.id)
			.execute();

		const { invalidateCache } = await import("@/helpers/cache");
		const { CacheKeys } = await import("@/helpers/cache-keys");
		const { createHash } = await import("node:crypto");
		const oldHash = createHash("sha256").update(created.token).digest("hex");
		await invalidateCache(CacheKeys.serviceTokenByHash(oldHash));

		expect(await ServiceTokenService.validateTokenByHash(created.token)).toBeNull();
	});
});

describe("service token path scopes", () => {
	test("denies env access outside the scoped path", async () => {
		await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "db/password",
				value: "secret-db",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});
		await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				key: "API_KEY",
				value: "secret-api",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});

		const created = await createServiceToken({
			name: "db-only",
			app_id: appId,
			scopes: [{ env_type_id: envTypeId, path: "/db" }],
			permissions: { read: true, write: true },
		});

		const allowed = await testRequest("/api/env/single", {
			method: "PUT",
			token: created.token,
			body: {
				key: "db/host",
				value: "localhost",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});
		expect(allowed.status).toBe(201);

		const denied = await testRequest("/api/env/single", {
			method: "PUT",
			token: created.token,
			body: {
				key: "API_KEY",
				value: "should-deny",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});
		expect(denied.status).toBe(403);
		const deniedBody = await denied.json<{ code?: string }>();
		expect(deniedBody.code).toBe("SERVICE_TOKEN_SCOPE_DENIED");
	});
});

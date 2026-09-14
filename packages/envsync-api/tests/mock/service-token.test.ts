import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { seedApp, seedEnvType, seedOrg, seedUser, type SeedOrgResult } from "../helpers/db";
import { MockFGAClient, setupUserOrgTuples } from "../helpers/fga";
import { resetVaultStore } from "../helpers/kms";
import { classifyServiceTokenOp } from "@/middlewares/service-token-scope.middleware";
import { parseServiceTokenScopes, ServiceTokenService } from "@/services/service_token.service";

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

	test("concurrent rotate allows only one successor", async () => {
		const created = await createServiceToken({
			name: "race-rotate",
			scopes: [{ env_type_id: envTypeId, path: "/" }],
		});

		const [first, second] = await Promise.all([
			testRequest(`/api/service_token/${created.id}/rotate`, {
				method: "POST",
				token: seed.masterUser.token,
				body: { grace_hours: 24 },
			}),
			testRequest(`/api/service_token/${created.id}/rotate`, {
				method: "POST",
				token: seed.masterUser.token,
				body: { grace_hours: 24 },
			}),
		]);

		const statuses = [first.status, second.status].sort();
		expect(statuses).toEqual([201, 400]);
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

	test("rejects the previous hash after grace_until expires without busting the cache", async () => {
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

		const warm = await testRequest("/api/env", {
			method: "POST",
			token: created.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(warm.status).toBe(200);
		expect(await ServiceTokenService.validateTokenByHash(created.token)).not.toBeNull();

		const { cacheSetJson } = await import("@/helpers/cache");
		const { CacheKeys, CacheTTL } = await import("@/helpers/cache-keys");
		const { CacheClient } = await import("@/libs/cache");
		const { createHash } = await import("node:crypto");
		const oldHash = createHash("sha256").update(created.token).digest("hex");
		const cacheKey = CacheKeys.serviceTokenByHash(oldHash);
		const cached = await CacheClient.get(cacheKey);
		expect(cached).not.toBeNull();
		const parsed = JSON.parse(cached as string);
		parsed.grace_until = new Date(Date.now() - 1000).toISOString();
		await cacheSetJson(cacheKey, parsed, CacheTTL.SHORT);

		expect(await ServiceTokenService.validateTokenByHash(created.token)).toBeNull();

		const expired = await testRequest("/api/env", {
			method: "POST",
			token: created.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(expired.status).toBe(401);
	});
});

describe("service token path scopes", () => {
	test("treats /db as a path boundary, not a string prefix of /dbx", () => {
		const token = {
			env_type_id: envTypeId,
			scopes: [{ env_type_id: envTypeId, path: "/db" }],
		};
		expect(ServiceTokenService.isPathAllowed(token, envTypeId, "/db")).toBe(true);
		expect(ServiceTokenService.isPathAllowed(token, envTypeId, "/db/host")).toBe(true);
		expect(ServiceTokenService.isPathAllowed(token, envTypeId, "/dbx")).toBe(false);
		expect(ServiceTokenService.isPathAllowed(token, envTypeId, "/dbx/password")).toBe(false);
	});

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

	test("denies reveal and batch delete when body.keys is outside the scoped path", async () => {
		const created = await createServiceToken({
			name: "keys-body",
			app_id: appId,
			scopes: [{ env_type_id: envTypeId, path: "/db" }],
			permissions: { read: true, write: true },
		});

		const reveal = await testRequest("/api/secret/reveal", {
			method: "POST",
			token: created.token,
			body: { app_id: appId, env_type_id: envTypeId, keys: ["API_KEY"] },
		});
		expect(reveal.status).toBe(403);
		expect((await reveal.json<{ code?: string }>()).code).toBe("SERVICE_TOKEN_SCOPE_DENIED");

		const batchDelete = await testRequest("/api/env/batch", {
			method: "DELETE",
			token: created.token,
			body: { app_id: appId, env_type_id: envTypeId, keys: ["API_KEY"] },
		});
		expect(batchDelete.status).toBe(403);
		expect((await batchDelete.json<{ code?: string }>()).code).toBe("SERVICE_TOKEN_SCOPE_DENIED");
	});

	test("denies keyless full rollback for a non-root path scope", async () => {
		const created = await createServiceToken({
			name: "no-rollback",
			app_id: appId,
			scopes: [{ env_type_id: envTypeId, path: "/db" }],
			permissions: { read: true, write: true },
		});

		const rollback = await testRequest("/api/env/rollback/pit", {
			method: "POST",
			token: created.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				pit_id: "00000000-0000-0000-0000-000000000001",
			},
		});
		expect(rollback.status).toBe(403);
		expect((await rollback.json<{ code?: string }>()).code).toBe("SERVICE_TOKEN_SCOPE_DENIED");
	});

	test("lists tokens for one project and does not reuse page 1 for page 2", async () => {
		const otherApp = await seedApp(seed.org.id);
		const first = await createServiceToken({
			name: "this-app-a",
			app_id: appId,
			scopes: [{ env_type_id: envTypeId, path: "/" }],
		});
		const second = await createServiceToken({
			name: "this-app-b",
			app_id: appId,
			scopes: [{ env_type_id: envTypeId, path: "/" }],
		});
		await createServiceToken({
			name: "other-app",
			app_id: otherApp.id,
			scopes: [{ path: "/" }],
		});

		const filtered = await testRequest(`/api/service_token?app_id=${appId}`, {
			token: seed.masterUser.token,
		});
		expect(filtered.status).toBe(200);
		const filteredBody = await filtered.json<Array<{ id: string; app_id: string | null }>>();
		const filteredIds = filteredBody.map(token => token.id);
		expect(filteredBody.every(token => token.app_id === appId)).toBe(true);
		expect(filteredIds).toContain(first.id);
		expect(filteredIds).toContain(second.id);

		const pageOne = await testRequest(`/api/service_token?app_id=${appId}&page=1&per_page=1`, {
			token: seed.masterUser.token,
		});
		const pageTwo = await testRequest(`/api/service_token?app_id=${appId}&page=2&per_page=1`, {
			token: seed.masterUser.token,
		});
		expect(pageOne.status).toBe(200);
		expect(pageTwo.status).toBe(200);
		const pageOneBody = await pageOne.json<Array<{ id: string }>>();
		const pageTwoBody = await pageTwo.json<Array<{ id: string }>>();
		expect(pageOneBody).toHaveLength(1);
		expect(pageTwoBody).toHaveLength(1);
		expect(pageOneBody[0]?.id).not.toBe(pageTwoBody[0]?.id);
	});

	test("fails closed on empty or corrupt stored scopes", () => {
		expect(() => parseServiceTokenScopes([], null)).toThrow("missing or invalid");
		expect(() => parseServiceTokenScopes("not-json", null)).toThrow("not valid JSON");
		expect(() => parseServiceTokenScopes({}, null)).toThrow("missing or invalid");
		expect(parseServiceTokenScopes(undefined, "env-1", { defaultRoot: true })).toEqual([
			{ env_type_id: "env-1", path: "/" },
		]);
	});

	test("classifies env/secret route tails, not key names that contain those words", () => {
		expect(classifyServiceTokenOp("PUT", "/api/env/single")).toEqual({
			permission: "write",
			allowKeyless: false,
		});
		expect(classifyServiceTokenOp("POST", "/api/env/batch")).toEqual({
			permission: "write",
			allowKeyless: false,
		});
		expect(classifyServiceTokenOp("POST", "/api/env/i/batch")).toEqual({
			permission: "read",
			allowKeyless: true,
		});
		expect(classifyServiceTokenOp("POST", "/api/env/rollback/pit")).toEqual({
			permission: "write",
			allowKeyless: false,
		});
		expect(classifyServiceTokenOp("POST", "/api/env/history")).toEqual({
			permission: "read",
			allowKeyless: false,
		});
		expect(classifyServiceTokenOp("POST", "/api/env")).toEqual({
			permission: "read",
			allowKeyless: true,
		});
		expect(classifyServiceTokenOp("DELETE", "/api/env")).toEqual({
			permission: "write",
			allowKeyless: false,
		});
	});

	test("rejects service tokens on non env/secret routes", async () => {
		const created = await createServiceToken({
			name: "route-bound",
			scopes: [{ env_type_id: envTypeId, path: "/" }],
		});

		const apps = await testRequest("/api/app", {
			token: created.token,
		});
		expect(apps.status).toBe(403);
		expect((await apps.json<{ code?: string }>()).code).toBe("SERVICE_TOKEN_ROUTE_DENIED");

		const manage = await testRequest("/api/service_token", {
			token: created.token,
		});
		expect(manage.status).toBe(403);
		expect((await manage.json<{ code?: string }>()).code).toBe("SERVICE_TOKEN_ROUTE_DENIED");
	});
});

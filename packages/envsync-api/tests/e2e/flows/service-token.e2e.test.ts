/**
 * E2E: service token create → scoped vault access → rotate.
 */
import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../../helpers/request";
import {
	checkServiceHealth,
	seedE2EOrg,
	seedE2EUser,
	setupE2EUserPermissions,
	type E2ESeed,
} from "../helpers/real-auth";

let seed: E2ESeed;
let viewerUser: { id: string; token: string };
let appId: string;
let envTypeId: string;

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	viewerUser = await seedE2EUser(seed.org.id, seed.roles.viewer.id);
	await setupE2EUserPermissions(viewerUser.id, seed.org.id, { can_view: true });

	const appRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "E2E Service Token App", description: "Service token API e2e" },
	});
	expect(appRes.status).toBe(201);
	appId = (await appRes.json<{ id: string }>()).id;

	const envRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "development", app_id: appId },
	});
	expect(envRes.status).toBe(201);
	envTypeId = (await envRes.json<{ id: string }>()).id;
});

describe("Service Token E2E", () => {
	let tokenId: string;
	let rawToken: string;

	test("master creates a hashed esv_ token and the raw value is returned once", async () => {
		const res = await testRequest("/api/service_token", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "E2E CI token",
				app_id: appId,
				scopes: [{ env_type_id: envTypeId, path: "/db" }],
				permissions: { read: true, write: true },
				expires_in_days: 7,
			},
		});
		expect(res.status).toBe(201);
		const body = await res.json<{ id: string; token: string; token_hash?: string }>();
		expect(body.token).toStartWith("esv_");
		expect(body.token_hash).toBeUndefined();
		tokenId = body.id;
		rawToken = body.token;

		const fetched = await testRequest(`/api/service_token/${tokenId}`, {
			token: seed.masterUser.token,
		});
		expect(fetched.status).toBe(200);
		const fetchedBody = await fetched.json<{ token?: string; token_hash?: string }>();
		expect(fetchedBody.token).toBeUndefined();
		expect(fetchedBody.token_hash).toBeUndefined();
	});

	test("scoped token can write under /db and is denied outside that path", async () => {
		const allowed = await testRequest("/api/env/single", {
			method: "PUT",
			token: rawToken,
			body: {
				key: "db/host",
				value: "db.internal",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});
		expect(allowed.status).toBe(201);

		const denied = await testRequest("/api/env/single", {
			method: "PUT",
			token: rawToken,
			body: {
				key: "API_KEY",
				value: "should-deny",
				app_id: appId,
				env_type_id: envTypeId,
			},
		});
		expect(denied.status).toBe(403);
		expect((await denied.json<{ code?: string }>()).code).toBe("SERVICE_TOKEN_SCOPE_DENIED");
	});

	test("service tokens cannot hit non env/secret routes", async () => {
		const res = await testRequest("/api/app", { token: rawToken });
		expect(res.status).toBe(403);
		expect((await res.json<{ code?: string }>()).code).toBe("SERVICE_TOKEN_ROUTE_DENIED");
	});

	test("rotate issues a new esv_ token and keeps the previous hash during grace", async () => {
		const rotateRes = await testRequest(`/api/service_token/${tokenId}/rotate`, {
			method: "POST",
			token: seed.masterUser.token,
			body: { grace_hours: 24 },
		});
		expect(rotateRes.status).toBe(201);
		const rotated = await rotateRes.json<{
			id: string;
			token: string;
			rotated_from_id: string | null;
		}>();
		expect(rotated.id).not.toBe(tokenId);
		expect(rotated.token).toStartWith("esv_");
		expect(rotated.token).not.toBe(rawToken);
		expect(rotated.rotated_from_id).toBe(tokenId);

		const oldStillWorks = await testRequest("/api/env", {
			method: "POST",
			token: rawToken,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(oldStillWorks.status).toBe(200);

		const newWorks = await testRequest("/api/env", {
			method: "POST",
			token: rotated.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(newWorks.status).toBe(200);
	});

	test("viewer cannot create service tokens", async () => {
		const res = await testRequest("/api/service_token", {
			method: "POST",
			token: viewerUser.token,
			body: { name: "Should fail" },
		});
		expect(res.status).toBe(403);
	});
});

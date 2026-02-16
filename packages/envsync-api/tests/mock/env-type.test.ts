import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { seedOrg, seedApp, type SeedOrgResult } from "../helpers/db";
import { resetFGA, setupUserOrgTuples } from "../helpers/fga";
import { resetVault } from "../helpers/vault";

let seed: SeedOrgResult;
let appId: string;

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

	const app = await seedApp(seed.org.id);
	appId = app.id;
});

afterEach(() => {
	resetVault();
});

describe("GET /api/env_type", () => {
	test("returns empty array when no env types exist for org", async () => {
		// Create a fresh org with no env types
		const freshSeed = await seedOrg();
		setupUserOrgTuples(freshSeed.masterUser.id, freshSeed.org.id, {
			is_master: true,
			is_admin: true,
			can_view: true,
			can_edit: true,
			have_api_access: true,
			have_billing_options: true,
			have_webhook_access: true,
		});

		const res = await testRequest("/api/env_type", {
			token: freshSeed.masterUser.token,
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual([]);
	});
});

describe("POST /api/env_type", () => {
	test("creates an env type with valid data", async () => {
		const res = await testRequest("/api/env_type", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "production",
				app_id: appId,
				color: "#FF0000",
				is_default: false,
				is_protected: false,
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; name: string }>();
		expect(body.id).toBeDefined();
		expect(body.name).toBe("production");
	});

	test("returns 400 when name is missing", async () => {
		const res = await testRequest("/api/env_type", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
			},
		});
		expect(res.status).toBe(400);
	});
});

describe("GET /api/env_type/:id", () => {
	test("returns env type details", async () => {
		// Create env type first
		const createRes = await testRequest("/api/env_type", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "staging",
				app_id: appId,
				color: "#00FF00",
				is_default: false,
				is_protected: false,
			},
		});
		const { id } = await createRes.json<{ id: string }>();

		// Note: getEnvType controller reads id from JSON body (not URL param)
		const res = await testRequest(`/api/env_type/${id}`, {
			method: "GET",
			token: seed.masterUser.token,
			body: { id },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; name: string; app_id: string }>();
		expect(body.id).toBe(id);
		expect(body.name).toBe("staging");
		expect(body.app_id).toBe(appId);
	});
});

describe("PATCH /api/env_type/:id", () => {
	test("updates env type name and color", async () => {
		const createRes = await testRequest("/api/env_type", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "dev",
				app_id: appId,
				color: "#0000FF",
				is_default: true,
				is_protected: false,
			},
		});
		const { id } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/env_type/${id}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				id,
				name: "development",
				color: "#00FFFF",
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Env type updated successfully.");
	});
});

describe("DELETE /api/env_type/:id", () => {
	test("deletes an env type", async () => {
		const createRes = await testRequest("/api/env_type", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "to-delete",
				app_id: appId,
				color: "#999999",
				is_default: false,
				is_protected: false,
			},
		});
		const { id } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/env_type/${id}`, {
			method: "DELETE",
			token: seed.masterUser.token,
			body: { id },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Env type deleted successfully.");
	});
});

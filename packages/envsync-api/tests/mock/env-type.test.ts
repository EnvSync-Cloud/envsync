import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { seedOrg, seedApp, type SeedOrgResult } from "../helpers/db";
import { resetFGA, setupUserOrgTuples } from "../helpers/fga";
import { resetVaultStore } from "../helpers/kms";

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
	resetVaultStore();
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
	test("updates env type name, color, and protection state", async () => {
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
				name: "development-renamed",
				color: "#00FFFF",
				is_protected: true,
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			id: string;
			name: string;
			color: string;
			is_protected: boolean;
		}>();
		expect(body.id).toBe(id);
		expect(body.name).toBe("development-renamed");
		expect(body.color).toBe("#00FFFF");
		expect(body.is_protected).toBe(true);
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

describe("environment name uniqueness", () => {
	test("returns 409 when the same project already has that name", async () => {
		const first = await testRequest("/api/env_type", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "Development",
				app_id: appId,
				color: "#112233",
				is_default: false,
				is_protected: false,
			},
		});
		expect(first.status).toBe(201);

		const second = await testRequest("/api/env_type", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "Development",
				app_id: appId,
				color: "#445566",
				is_default: false,
				is_protected: false,
			},
		});
		expect(second.status).toBe(409);
		const body = await second.json<{ error: string }>();
		expect(body.error).toContain("already exists");
	});

	test("allows the same name on two projects in one organization", async () => {
		const other = await seedApp(seed.org.id, { name: `Second Project ${Date.now()}` });
		const res = await testRequest("/api/env_type", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "Development",
				app_id: other.id,
				color: "#778899",
				is_default: false,
				is_protected: false,
			},
		});
		expect(res.status).toBe(201);
	});

	test("treats Development and development as different names", async () => {
		const lower = await testRequest("/api/env_type", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "qa",
				app_id: appId,
				color: "#abcdef",
				is_default: false,
				is_protected: false,
			},
		});
		expect(lower.status).toBe(201);

		const upper = await testRequest("/api/env_type", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "QA",
				app_id: appId,
				color: "#fedcba",
				is_default: false,
				is_protected: false,
			},
		});
		expect(upper.status).toBe(201);
	});
});

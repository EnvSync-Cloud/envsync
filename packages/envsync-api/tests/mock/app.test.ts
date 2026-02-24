import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../helpers/request";
import { cleanupDB, seedOrg, seedUser, type SeedOrgResult } from "../helpers/db";
import { resetFGA, setupUserOrgTuples } from "../helpers/fga";
import { resetVault } from "../helpers/vault";

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

	// Create a viewer user without can_manage_apps permission
	const viewer = await seedUser(seed.org.id, seed.roles.viewer.id);
	viewerToken = viewer.token;
	setupUserOrgTuples(viewer.id, seed.org.id, {
		can_view: true,
	});
});

afterEach(() => {
	resetVault();
});

describe("GET /api/app", () => {
	test("returns empty array when no apps exist", async () => {
		const res = await testRequest("/api/app", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual([]);
	});
});

describe("POST /api/app/", () => {
	test("creates an app with valid data", async () => {
		const res = await testRequest("/api/app", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Test App", description: "A test application" },
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; name: string; org_id: string }>();
		expect(body.id).toBeDefined();
		expect(body.name).toBe("Test App");
		expect(body.org_id).toBe(seed.org.id);
	});

	test("returns 400 when name is missing", async () => {
		const res = await testRequest("/api/app", {
			method: "POST",
			token: seed.masterUser.token,
			body: { description: "No name" },
		});
		// Zod validation will reject missing name
		expect(res.status).toBe(400);
	});

	test("returns 403 for user without can_manage_apps", async () => {
		const res = await testRequest("/api/app", {
			method: "POST",
			token: viewerToken,
			body: { name: "Forbidden App", description: "Should fail" },
		});
		expect(res.status).toBe(403);
	});
});

describe("GET /api/app/:id", () => {
	test("returns app details with env counts", async () => {
		// Create app first
		const createRes = await testRequest("/api/app", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Detail App", description: "Test" },
		});
		const { id } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/app/${id}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			id: string;
			name: string;
			env_types: any[];
			envCount: number;
			secretCount: number;
		}>();
		expect(body.id).toBe(id);
		expect(body.name).toBe("Detail App");
		expect(body.env_types).toBeArray();
		expect(body.envCount).toBe(0);
		expect(body.secretCount).toBe(0);
	});
});

describe("PATCH /api/app/:id", () => {
	test("updates app name", async () => {
		const createRes = await testRequest("/api/app", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "Before Update", description: "Test" },
		});
		const { id } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/app/${id}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { name: "After Update" },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("App updated successfully");

		// Verify the update
		const getRes = await testRequest(`/api/app/${id}`, {
			token: seed.masterUser.token,
		});
		const app = await getRes.json<{ name: string }>();
		expect(app.name).toBe("After Update");
	});

	test("returns 403 for viewer", async () => {
		const createRes = await testRequest("/api/app", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "No Update", description: "Test" },
		});
		const { id } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/app/${id}`, {
			method: "PATCH",
			token: viewerToken,
			body: { name: "Should Fail" },
		});
		expect(res.status).toBe(403);
	});
});

describe("DELETE /api/app/:id", () => {
	test("deletes an app", async () => {
		const createRes = await testRequest("/api/app", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "To Delete", description: "Test" },
		});
		const { id } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/app/${id}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("App deleted successfully");

		// Verify it's gone
		const getRes = await testRequest(`/api/app/${id}`, {
			token: seed.masterUser.token,
		});
		expect(getRes.status).toBe(404); // orNotFound throws NotFoundError
	});

	test("returns 403 for viewer", async () => {
		const createRes = await testRequest("/api/app", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: "No Delete", description: "Test" },
		});
		const { id } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/app/${id}`, {
			method: "DELETE",
			token: viewerToken,
		});
		expect(res.status).toBe(403);
	});
});

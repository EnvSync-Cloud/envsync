import { beforeAll, describe, expect, test } from "bun:test";

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

describe("GET /api/role", () => {
	test("returns all roles for org", async () => {
		const res = await testRequest("/api/role", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body.length).toBe(5); // 5 default roles
	});
});

describe("POST /api/role", () => {
	test("master can create a new role", async () => {
		const res = await testRequest("/api/role", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "Custom Role",
				can_edit: true,
				can_view: true,
				have_api_access: false,
				have_billing_options: false,
				have_webhook_access: false,
				have_gpg_access: false,
				have_cert_access: false,
				have_audit_access: false,
				is_admin: false,
				color: "#ABCDEF",
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; name: string }>();
		expect(body.id).toBeDefined();
		expect(body.name).toBe("Custom Role");
	});

	test("viewer gets 403", async () => {
		const res = await testRequest("/api/role", {
			method: "POST",
			token: viewerToken,
			body: {
				name: "Forbidden Role",
				can_edit: false,
				can_view: false,
				have_api_access: false,
				have_billing_options: false,
				have_webhook_access: false,
				have_gpg_access: false,
				have_cert_access: false,
				have_audit_access: false,
				is_admin: false,
				color: "#000000",
			},
		});
		expect(res.status).toBe(403);
	});
});

describe("GET /api/role/:id", () => {
	test("returns role details", async () => {
		const res = await testRequest(`/api/role/${seed.roles.master.id}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; name: string }>();
		expect(body.id).toBe(seed.roles.master.id);
	});
});

describe("PATCH /api/role/:id", () => {
	test("master can update a role", async () => {
		// Create a role to update
		const createRes = await testRequest("/api/role", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "Editable Role",
				can_edit: false,
				can_view: true,
				have_api_access: false,
				have_billing_options: false,
				have_webhook_access: false,
				have_gpg_access: false,
				have_cert_access: false,
				have_audit_access: false,
				is_admin: false,
				color: "#111111",
			},
		});
		const { id } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/role/${id}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { name: "Updated Role", can_edit: true },
		});
		expect(res.status).toBe(200);
	});
});

describe("DELETE /api/role/:id", () => {
	test("master can delete a non-master role", async () => {
		// Create a role to delete
		const createRes = await testRequest("/api/role", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "Disposable Role",
				can_edit: false,
				can_view: false,
				have_api_access: false,
				have_billing_options: false,
				have_webhook_access: false,
				have_gpg_access: false,
				have_cert_access: false,
				have_audit_access: false,
				is_admin: false,
				color: "#222222",
			},
		});
		const { id } = await createRes.json<{ id: string }>();

		const res = await testRequest(`/api/role/${id}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});
});

describe("GET /api/role/stats", () => {
	test("returns role statistics", async () => {
		const res = await testRequest("/api/role/stats", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});
});

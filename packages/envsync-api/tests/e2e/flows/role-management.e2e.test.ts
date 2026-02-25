/**
 * E2E: Role management — list → get → stats → create → update → delete
 *
 * Uses real SpacetimeDB and Keycloak.
 * seedE2EOrg() creates 4 default roles (master, admin, developer, viewer).
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

describe("Role Management E2E", () => {
	let customRoleId: string;

	test("list all roles", async () => {
		const res = await testRequest("/api/role", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		// seedE2EOrg creates 4 default roles
		expect(body.length).toBeGreaterThanOrEqual(4);
	});

	test("get role by ID", async () => {
		const res = await testRequest(`/api/role/${seed.roles.master.id}`, {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ id: string; name: string }>();
		expect(body.id).toBe(seed.roles.master.id);
		expect(body.name).toBe("Org Admin");
	});

	test("get role stats", async () => {
		const res = await testRequest("/api/role/stats", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<any>();
		expect(body).toBeDefined();
	});

	test("create custom role", async () => {
		const res = await testRequest("/api/role", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				name: "E2E Custom Role",
				can_edit: true,
				can_view: true,
				have_api_access: false,
				have_billing_options: false,
				have_webhook_access: false,
				have_gpg_access: false,
				have_cert_access: false,
				have_audit_access: false,
				is_admin: false,
				color: "#123456",
			},
		});
		expect(res.status).toBe(201);

		const body = await res.json<{ id: string; name: string }>();
		expect(body.id).toBeDefined();
		expect(body.name).toBe("E2E Custom Role");
		customRoleId = body.id;
	});

	test("update custom role", async () => {
		const res = await testRequest(`/api/role/${customRoleId}`, {
			method: "PATCH",
			token: seed.masterUser.token,
			body: { name: "E2E Updated Role" },
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBe("Role updated successfully.");
	});

	test("delete custom role", async () => {
		const res = await testRequest(`/api/role/${customRoleId}`, {
			method: "DELETE",
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);
	});

	test("viewer cannot create role (403)", async () => {
		const res = await testRequest("/api/role", {
			method: "POST",
			token: viewerUser.token,
			body: {
				name: "Should Fail",
				can_edit: false,
				can_view: true,
				have_api_access: false,
				have_billing_options: false,
				have_webhook_access: false,
				have_gpg_access: false,
				have_cert_access: false,
				have_audit_access: false,
				is_admin: false,
			},
		});
		expect(res.status).toBe(403);
	});
});

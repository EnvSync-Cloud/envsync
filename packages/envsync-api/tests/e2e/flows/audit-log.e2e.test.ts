/**
 * E2E: Audit log — perform actions → verify they appear in audit logs
 *
 * Tests that CRUD operations generate audit log entries.
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

	// Generate audit log entries by creating an app
	await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "Audit E2E App", description: "For audit log testing" },
	});
});

describe("Audit Log E2E", () => {
	test("returns audit logs with pagination", async () => {
		const res = await testRequest("/api/audit_log", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ auditLogs: any[]; totalPages: number }>();
		expect(body.auditLogs).toBeArray();
		expect(body.auditLogs.length).toBeGreaterThan(0);
		expect(body.totalPages).toBeGreaterThanOrEqual(1);
	});

	test("audit logs contain app_created action", async () => {
		const res = await testRequest("/api/audit_log", {
			token: seed.masterUser.token,
		});
		const body = await res.json<{ auditLogs: any[] }>();

		const appCreated = body.auditLogs.find(
			(log: any) => log.action === "app_created",
		);
		expect(appCreated).toBeDefined();
		expect(appCreated.user_id).toBe(seed.masterUser.id);
	});

	test("viewer without can_view_audit_logs gets 403", async () => {
		const res = await testRequest("/api/audit_log", {
			token: viewerUser.token,
		});
		expect(res.status).toBe(403);
	});
});

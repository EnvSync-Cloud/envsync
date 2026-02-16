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

	// Generate some audit log entries by performing actions
	await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "Audit Test App", description: "For audit logs" },
	});
});

describe("GET /api/audit_log", () => {
	test("returns audit logs for org", async () => {
		const res = await testRequest("/api/audit_log", {
			token: seed.masterUser.token,
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ auditLogs: any[]; totalPages: number }>();
		expect(body.auditLogs).toBeArray();
		expect(body.auditLogs.length).toBeGreaterThan(0);
		expect(body.totalPages).toBeGreaterThanOrEqual(1);
	});

	test("viewer without can_view_audit_logs gets 403", async () => {
		const res = await testRequest("/api/audit_log", {
			token: viewerToken,
		});
		expect(res.status).toBe(403);
	});
});

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

	test("q filters action, details, and message", async () => {
		const needle = `audit-search-${crypto.randomUUID()}`;
		await testRequest("/api/app", {
			method: "POST",
			token: seed.masterUser.token,
			body: { name: needle, description: "searchable audit app" },
		});

		const hit = await testRequest(`/api/audit_log?q=${encodeURIComponent(needle)}`, {
			token: seed.masterUser.token,
		});
		expect(hit.status).toBe(200);
		const hitBody = await hit.json<{ auditLogs: Array<{ details: string; message: string }>; totalPages: number }>();
		expect(hitBody.auditLogs.length).toBeGreaterThan(0);
		expect(
			hitBody.auditLogs.every((log) =>
				`${log.details} ${log.message}`.toLowerCase().includes(needle.toLowerCase()),
			),
		).toBe(true);

		const miss = await testRequest("/api/audit_log?q=definitely-not-in-any-audit-row", {
			token: seed.masterUser.token,
		});
		expect(miss.status).toBe(200);
		const missBody = await miss.json<{ auditLogs: unknown[] }>();
		expect(missBody.auditLogs).toHaveLength(0);
	});
});

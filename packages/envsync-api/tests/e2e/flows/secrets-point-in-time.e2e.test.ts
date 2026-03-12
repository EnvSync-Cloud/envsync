/**
 * E2E: Secret Point-in-Time — create secrets → update → get history → PIT → diff → timeline
 *
 * Uses real PostgreSQL and OpenFGA. miniKMS VaultService stores encrypted secrets.
 * Mirrors env-point-in-time.e2e.test.ts but for the /api/secret PIT routes.
 */
import { beforeAll, describe, expect, test } from "bun:test";

import { testRequest } from "../../helpers/request";
import {
	seedE2EOrg,
	checkServiceHealth,
	type E2ESeed,
} from "../helpers/real-auth";

let seed: E2ESeed;
let appId: string;
let envTypeId: string;

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	// Create app with secrets enabled
	const appRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: {
			name: "E2E Secret PIT App",
			description: "For secret PIT tests",
			enable_secrets: true,
		},
	});
	const appBody = await appRes.json<{ id: string }>();
	appId = appBody.id;

	// Create env type
	const envTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "secret-pit-staging", app_id: appId },
	});
	const envTypeBody = await envTypeRes.json<{ id: string }>();
	envTypeId = envTypeBody.id;
});

describe("Secret Point-in-Time E2E", () => {
	let firstPitId: string;
	let secondPitId: string;

	test("create initial secrets (setup)", async () => {
		const res = await testRequest("/api/secret/batch", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				envs: [
					{ key: "DB_PASSWORD", value: "secret-password-v1" },
					{ key: "API_SECRET", value: "sk-secret-key-123" },
					{ key: "JWT_SECRET", value: "jwt-super-secret" },
				],
			},
		});
		expect(res.status).toBe(201);
	});

	test("update secret (generates history)", async () => {
		const res = await testRequest("/api/secret/i/DB_PASSWORD", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				value: "secret-password-v2",
			},
		});
		expect(res.status).toBe(200);
	});

	test("get secret history", async () => {
		const res = await testRequest("/api/secret/history", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				page: 1,
				per_page: 20,
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ pits: any[]; totalPages: number }>();
		expect(body.pits).toBeArray();
		expect(body.pits.length).toBeGreaterThanOrEqual(2);
		expect(body.totalPages).toBeGreaterThanOrEqual(1);

		// Capture PIT IDs for subsequent tests (most recent first)
		firstPitId = body.pits[body.pits.length - 1].id; // earliest
		secondPitId = body.pits[0].id; // most recent
	});

	test("get secrets at point in time", async () => {
		const res = await testRequest("/api/secret/pit", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				pit_id: firstPitId,
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		expect(body.length).toBeGreaterThan(0);
	});

	test("get secrets at timestamp", async () => {
		const res = await testRequest("/api/secret/timestamp", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				timestamp: new Date().toISOString(),
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
	});

	test("get secret diff between PITs", async () => {
		const res = await testRequest("/api/secret/diff", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				from_pit_id: firstPitId,
				to_pit_id: secondPitId,
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			added: any[];
			modified: any[];
			deleted: any[];
		}>();
		expect(body).toBeDefined();
		// The update of DB_PASSWORD should appear as modified
		expect(body.modified.length + body.added.length + body.deleted.length).toBeGreaterThan(0);
	});

	test("get secret variable timeline", async () => {
		const res = await testRequest("/api/secret/timeline/DB_PASSWORD", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				key: "DB_PASSWORD",
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		// Should have at least 2 entries (CREATE + UPDATE)
		expect(body.length).toBeGreaterThanOrEqual(2);
	});
});

/**
 * E2E: Env Point-in-Time — create vars → update → get history → PIT → diff → timeline
 *
 * Uses real PostgreSQL and OpenFGA. Vault is mocked with in-memory KV v2.
 * Creates env vars, updates them to generate history, then queries PIT endpoints.
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

	// Create app
	const appRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "E2E PIT App", description: "For PIT tests" },
	});
	const appBody = await appRes.json<{ id: string }>();
	appId = appBody.id;

	// Create env type
	const envTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "pit-staging", app_id: appId },
	});
	const envTypeBody = await envTypeRes.json<{ id: string }>();
	envTypeId = envTypeBody.id;
});

describe("Env Point-in-Time E2E", () => {
	let firstPitId: string;
	let secondPitId: string;

	test("create initial env vars (setup)", async () => {
		const res = await testRequest("/api/env/batch", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				envs: [
					{ key: "DATABASE_URL", value: "postgres://localhost/pit_test" },
					{ key: "REDIS_URL", value: "redis://localhost:6379" },
					{ key: "LOG_LEVEL", value: "info" },
				],
			},
		});
		expect(res.status).toBe(201);
	});

	test("update variable (generates history)", async () => {
		const res = await testRequest("/api/env/i/DATABASE_URL", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				value: "postgres://localhost/pit_test_v2",
			},
		});
		expect(res.status).toBe(200);
	});

	test("get env history", async () => {
		const res = await testRequest("/api/env/history", {
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

	test("get envs at point in time", async () => {
		const res = await testRequest("/api/env/pit", {
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

	test("get envs at timestamp", async () => {
		const res = await testRequest("/api/env/timestamp", {
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

	test("get env diff between PITs", async () => {
		const res = await testRequest("/api/env/diff", {
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
		// The update of DATABASE_URL should appear as modified
		expect(body.modified.length + body.added.length + body.deleted.length).toBeGreaterThan(0);
	});

	test("get variable timeline", async () => {
		const res = await testRequest("/api/env/timeline/DATABASE_URL", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				key: "DATABASE_URL",
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		expect(body).toBeArray();
		// Should have at least 2 entries (CREATE + UPDATE)
		expect(body.length).toBeGreaterThanOrEqual(2);
	});
});

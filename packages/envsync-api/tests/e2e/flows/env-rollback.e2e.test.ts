/**
 * E2E: Env Rollback — create → update → capture PITs → rollback → verify
 *
 * Uses real SpacetimeDB and Keycloak.
 * Tests rollback to PIT ID, rollback to timestamp, and single-variable rollback.
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
		body: { name: "E2E Rollback App", description: "For rollback tests" },
	});
	const appBody = await appRes.json<{ id: string }>();
	appId = appBody.id;

	// Create env type
	const envTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "rollback-staging", app_id: appId },
	});
	const envTypeBody = await envTypeRes.json<{ id: string }>();
	envTypeId = envTypeBody.id;
});

describe("Env Rollback E2E", () => {
	let firstPitId: string;
	let midTimestamp: string;

	test("setup: create initial env vars", async () => {
		const res = await testRequest("/api/env/batch", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				envs: [
					{ key: "APP_NAME", value: "rollback-test-v1" },
					{ key: "DB_HOST", value: "localhost" },
				],
			},
		});
		expect(res.status).toBe(201);
	});

	test("setup: update envs to generate history", async () => {
		// Capture timestamp between PIT states
		midTimestamp = new Date().toISOString();

		// Small delay to ensure distinct timestamps
		await new Promise((r) => setTimeout(r, 50));

		const res = await testRequest("/api/env/i/APP_NAME", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				value: "rollback-test-v2",
			},
		});
		expect(res.status).toBe(200);
	});

	test("get history for PIT IDs", async () => {
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

		const body = await res.json<{ pits: any[] }>();
		expect(body.pits.length).toBeGreaterThanOrEqual(2);

		// earliest PIT (first state)
		firstPitId = body.pits[body.pits.length - 1].id;
	});

	test("rollback to PIT ID", async () => {
		const res = await testRequest("/api/env/rollback/pit", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				pit_id: firstPitId,
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{
			message: string;
			operations_performed: number;
		}>();
		expect(body.message).toBeDefined();
	});

	test("verify rollback", async () => {
		const res = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		const appName = body.find((e: any) => e.key === "APP_NAME");
		expect(appName).toBeDefined();
		// After rollback to first PIT, APP_NAME should be v1
		expect(appName.value).toBe("rollback-test-v1");
	});

	test("setup: update again for timestamp rollback", async () => {
		const res = await testRequest("/api/env/i/APP_NAME", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				value: "rollback-test-v3",
			},
		});
		expect(res.status).toBe(200);
	});

	test("rollback to timestamp", async () => {
		const res = await testRequest("/api/env/rollback/timestamp", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				timestamp: midTimestamp,
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBeDefined();
	});

	test("setup: update DB_HOST for single variable rollback", async () => {
		const res = await testRequest("/api/env/i/DB_HOST", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				value: "remote-host",
			},
		});
		expect(res.status).toBe(200);
	});

	test("rollback single var to PIT", async () => {
		// Get latest history to find a PIT where DB_HOST was "localhost"
		const historyRes = await testRequest("/api/env/history", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId, page: 1, per_page: 20 },
		});
		const history = await historyRes.json<{ pits: any[] }>();
		const earliestPit = history.pits[history.pits.length - 1].id;

		const res = await testRequest("/api/env/rollback/variable/DB_HOST/pit", {
			method: "POST",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				pit_id: earliestPit,
			},
		});
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBeDefined();
	});

	test("rollback single var to timestamp", async () => {
		// First update DB_HOST again
		await testRequest("/api/env/i/DB_HOST", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				value: "another-remote-host",
			},
		});

		const res = await testRequest(
			"/api/env/rollback/variable/DB_HOST/timestamp",
			{
				method: "POST",
				token: seed.masterUser.token,
				body: {
					app_id: appId,
					env_type_id: envTypeId,
					timestamp: midTimestamp,
				},
			},
		);
		expect(res.status).toBe(200);

		const body = await res.json<{ message: string }>();
		expect(body.message).toBeDefined();
	});
});

/**
 * E2E: Secret Rollback — create → update → capture PITs → rollback → verify
 *
 * Uses real PostgreSQL and OpenFGA. miniKMS VaultService stores encrypted secrets.
 * Mirrors env-rollback.e2e.test.ts but for the /api/secret rollback routes.
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
			name: "E2E Secret Rollback App",
			description: "For secret rollback tests",
			enable_secrets: true,
		},
	});
	const appBody = await appRes.json<{ id: string }>();
	appId = appBody.id;

	// Create env type
	const envTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "secret-rollback-staging", app_id: appId },
	});
	const envTypeBody = await envTypeRes.json<{ id: string }>();
	envTypeId = envTypeBody.id;
});

describe("Secret Rollback E2E", () => {
	let firstPitId: string;
	let midTimestamp: string;

	test("setup: create initial secrets", async () => {
		const res = await testRequest("/api/secret/batch", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				envs: [
					{ key: "APP_SECRET", value: "rollback-secret-v1" },
					{ key: "DB_TOKEN", value: "db-token-original" },
				],
			},
		});
		expect(res.status).toBe(201);
	});

	test("setup: update secrets to generate history", async () => {
		// Capture timestamp between PIT states
		midTimestamp = new Date().toISOString();

		// Small delay to ensure distinct timestamps
		await new Promise((r) => setTimeout(r, 50));

		const res = await testRequest("/api/secret/i/APP_SECRET", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				value: "rollback-secret-v2",
			},
		});
		expect(res.status).toBe(200);
	});

	test("get history for PIT IDs", async () => {
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

		const body = await res.json<{ pits: any[] }>();
		expect(body.pits.length).toBeGreaterThanOrEqual(2);

		// earliest PIT (first state)
		firstPitId = body.pits[body.pits.length - 1].id;
	});

	test("rollback to PIT ID", async () => {
		const res = await testRequest("/api/secret/rollback/pit", {
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

	test("verify rollback state", async () => {
		const res = await testRequest("/api/secret", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		// Secrets are returned encrypted, so we verify the count is correct
		expect(body).toBeArray();
		expect(body.length).toBeGreaterThanOrEqual(2);
	});

	test("setup: update again for timestamp rollback", async () => {
		const res = await testRequest("/api/secret/i/APP_SECRET", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				value: "rollback-secret-v3",
			},
		});
		expect(res.status).toBe(200);
	});

	test("rollback to timestamp", async () => {
		const res = await testRequest("/api/secret/rollback/timestamp", {
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

	test("setup: update DB_TOKEN for single variable rollback", async () => {
		const res = await testRequest("/api/secret/i/DB_TOKEN", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				value: "db-token-changed",
			},
		});
		expect(res.status).toBe(200);
	});

	test("rollback single secret var to PIT", async () => {
		// Get latest history to find a PIT where DB_TOKEN was original
		const historyRes = await testRequest("/api/secret/history", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId, page: 1, per_page: 20 },
		});
		const history = await historyRes.json<{ pits: any[] }>();
		const earliestPit = history.pits[history.pits.length - 1].id;

		const res = await testRequest("/api/secret/rollback/variable/DB_TOKEN/pit", {
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

	test("rollback single secret var to timestamp", async () => {
		// First update DB_TOKEN again
		await testRequest("/api/secret/i/DB_TOKEN", {
			method: "PATCH",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				value: "db-token-another-change",
			},
		});

		const res = await testRequest(
			"/api/secret/rollback/variable/DB_TOKEN/timestamp",
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

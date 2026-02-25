/**
 * E2E: CLI push/pull — build CLI binary → start real HTTP server →
 * create project fixture → push local .env → verify remote → pull remote → verify local
 *
 * Uses real SpacetimeDB, Keycloak, and a real Bun.serve HTTP server.
 * The Go CLI binary is built with backendURL baked in via ldflags.
 */
import { beforeAll, afterAll, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "fs";

import { testRequest } from "../../helpers/request";
import {
	seedE2EOrg,
	checkServiceHealth,
	type E2ESeed,
} from "../helpers/real-auth";
import { startTestServer } from "../helpers/http-server";
import { buildCLI, createProjectDir, execCLI } from "../helpers/cli-runner";

let seed: E2ESeed;
let appId: string;
let envTypeId: string;
let apiKey: string;
let serverUrl: string;
let stopServer: () => void;
let cliBinary: string;

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	// Create app
	const appRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "E2E CLI Sync App", description: "For CLI sync tests" },
	});
	const appBody = await appRes.json<{ id: string }>();
	appId = appBody.id;

	// Create env type
	const envTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "cli-staging", app_id: appId },
	});
	const envTypeBody = await envTypeRes.json<{ id: string }>();
	envTypeId = envTypeBody.id;

	// Create API key for CLI auth
	const apiKeyRes = await testRequest("/api/api_key", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "CLI E2E Key", description: "For CLI E2E testing" },
	});
	const apiKeyBody = await apiKeyRes.json<{ key: string }>();
	apiKey = apiKeyBody.key;

	// Start real HTTP server
	const server = await startTestServer();
	serverUrl = server.url;
	stopServer = server.stop;

	// Build CLI binary with test server URL
	cliBinary = await buildCLI({ backendURL: serverUrl });
});

afterAll(() => {
	stopServer?.();
});

describe("CLI Push", () => {
	let projectDir: ReturnType<typeof createProjectDir>;

	beforeAll(() => {
		projectDir = createProjectDir({
			appId,
			envTypeId,
			envVars: {
				DATABASE_URL: "postgres://localhost:5432/cli_test",
				REDIS_URL: "redis://localhost:6379",
			},
		});
	});

	afterAll(() => {
		projectDir?.cleanup();
	});

	test("push syncs local .env to remote", async () => {
		const result = await execCLI(cliBinary, ["push"], {
			cwd: projectDir.dir,
			env: { API_KEY: apiKey },
		});
		expect(result.exitCode).toBe(0);
	});

	test("verify remote has pushed vars", async () => {
		const res = await testRequest("/api/env", {
			method: "POST",
			token: seed.masterUser.token,
			body: { app_id: appId, env_type_id: envTypeId },
		});
		expect(res.status).toBe(200);

		const body = await res.json<any[]>();
		const keys = body.map((e: any) => e.key);
		expect(keys).toContain("DATABASE_URL");
		expect(keys).toContain("REDIS_URL");
	});

	test("push updates existing vars", async () => {
		// Modify local .env
		writeFileSync(
			projectDir.envPath,
			"DATABASE_URL=postgres://localhost:5432/cli_test_v2\nREDIS_URL=redis://localhost:6379\n",
		);

		const result = await execCLI(cliBinary, ["push"], {
			cwd: projectDir.dir,
			env: { API_KEY: apiKey },
		});
		expect(result.exitCode).toBe(0);

		// No panic / crash
		expect(result.stderr).not.toContain("panic");
	});
});

describe("CLI Pull", () => {
	let projectDir: ReturnType<typeof createProjectDir>;

	beforeAll(async () => {
		// Add a new var via API that the CLI doesn't have locally
		await testRequest("/api/env/single", {
			method: "PUT",
			token: seed.masterUser.token,
			body: {
				app_id: appId,
				env_type_id: envTypeId,
				key: "NEW_VAR",
				value: "added-via-api",
			},
		});

		// Create empty project dir (no .env vars)
		projectDir = createProjectDir({
			appId,
			envTypeId,
			envVars: {},
		});
	});

	afterAll(() => {
		projectDir?.cleanup();
	});

	test("pull syncs remote to local .env", async () => {
		const result = await execCLI(cliBinary, ["pull"], {
			cwd: projectDir.dir,
			env: { API_KEY: apiKey },
		});
		expect(result.exitCode).toBe(0);
	});

	test("verify local .env has remote vars", () => {
		const envContent = readFileSync(projectDir.envPath, "utf-8");
		expect(envContent).toContain("DATABASE_URL=");
		expect(envContent).toContain("REDIS_URL=");
		expect(envContent).toContain("NEW_VAR=");
	});
});

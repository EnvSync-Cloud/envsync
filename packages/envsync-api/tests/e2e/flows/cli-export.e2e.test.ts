/**
 * E2E: CLI export — env export for CI, env type resolution, secret inclusion,
 * self-managed decryption, and backend URL override.
 */
import { beforeAll, afterAll, describe, expect, test } from "bun:test";
import { generateKeyPairSync } from "crypto";
import { join } from "path";
import { writeFileSync } from "fs";

import { testRequest } from "../../helpers/request";
import { checkServiceHealth, seedE2EOrg, type E2ESeed } from "../helpers/real-auth";
import { startTestServer } from "../helpers/http-server";
import { buildCLI, createProjectDir, execCLI } from "../helpers/cli-runner";

let seed: E2ESeed;
let apiKey: string;
let serverUrl: string;
let stopServer: () => void;
let cliBinary: string;
let invalidBinary: string;

let plainAppId: string;
let plainEnvTypeId: string;
const plainEnvTypeName = "ci-export";

let managedAppId: string;
let managedEnvTypeId: string;

let selfManagedAppId: string;
let selfManagedEnvTypeId: string;
let selfManagedPrivateKey: string;

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	const apiKeyRes = await testRequest("/api/api_key", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "CLI Export Key", description: "For CLI export testing" },
	});
	const apiKeyBody = await apiKeyRes.json<{ key: string }>();
	apiKey = apiKeyBody.key;

	const server = await startTestServer();
	serverUrl = server.url;
	stopServer = server.stop;

	cliBinary = await buildCLI({ backendURL: serverUrl });
	invalidBinary = await buildCLI({ backendURL: "https://invalid.example.test" });

	const plainAppRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "CLI Export Plain", description: "Plain export app" },
	});
	plainAppId = (await plainAppRes.json<{ id: string }>()).id;

	const plainEnvTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: plainEnvTypeName, app_id: plainAppId },
	});
	plainEnvTypeId = (await plainEnvTypeRes.json<{ id: string }>()).id;

	await testRequest("/api/env/single", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			app_id: plainAppId,
			env_type_id: plainEnvTypeId,
			key: "PLAIN_ONLY",
			value: "plain-value",
		},
	});

	const managedAppRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: {
			name: "CLI Export Managed",
			description: "Managed secret export app",
			enable_secrets: true,
		},
	});
	managedAppId = (await managedAppRes.json<{ id: string }>()).id;

	const managedEnvTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "managed-ci", app_id: managedAppId },
	});
	managedEnvTypeId = (await managedEnvTypeRes.json<{ id: string }>()).id;

	await testRequest("/api/env/single", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			app_id: managedAppId,
			env_type_id: managedEnvTypeId,
			key: "SHARED_KEY",
			value: "env-value",
		},
	});

	await testRequest("/api/secret/single", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			app_id: managedAppId,
			env_type_id: managedEnvTypeId,
			key: "SHARED_KEY",
			value: "secret-wins",
		},
	});

	await testRequest("/api/secret/single", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			app_id: managedAppId,
			env_type_id: managedEnvTypeId,
			key: "MANAGED_SECRET",
			value: "managed-secret-value",
		},
	});

	const { publicKey, privateKey } = generateKeyPairSync("rsa", {
		modulusLength: 3072,
		publicKeyEncoding: { type: "spki", format: "pem" },
		privateKeyEncoding: { type: "pkcs8", format: "pem" },
	});
	selfManagedPrivateKey = privateKey;

	const selfManagedAppRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: {
			name: "CLI Export Self Managed",
			description: "Self managed export app",
			enable_secrets: true,
			public_key: publicKey,
		},
	});
	selfManagedAppId = (await selfManagedAppRes.json<{ id: string }>()).id;

	const selfManagedEnvTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "self-managed-ci", app_id: selfManagedAppId },
	});
	selfManagedEnvTypeId = (await selfManagedEnvTypeRes.json<{ id: string }>()).id;

	await testRequest("/api/env/single", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			app_id: selfManagedAppId,
			env_type_id: selfManagedEnvTypeId,
			key: "SELF_ENV",
			value: "self-env-value",
		},
	});

	await testRequest("/api/secret/single", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			app_id: selfManagedAppId,
			env_type_id: selfManagedEnvTypeId,
			key: "SELF_SECRET",
			value: "self-secret-value",
		},
	});
});

afterAll(() => {
	stopServer?.();
});

describe("CLI export E2E", () => {
	test("exports env vars by project and environment name", async () => {
		const projectDir = createProjectDir({
			appName: "CLI Export Plain",
			envTypeName: plainEnvTypeName,
		});

		const result = await execCLI(
			cliBinary,
			["export", "--app", "CLI Export Plain", "--env", plainEnvTypeName, "--format", "json"],
			{
				cwd: projectDir.dir,
				env: { API_KEY: apiKey },
			},
		);

		projectDir.cleanup();

		expect(result.exitCode).toBe(0);
		const payload = JSON.parse(result.stdout) as {
			resolved_env_type_id: string;
			resolved_env_type_name: string;
			environment: Record<string, string>;
			secrets_enabled: boolean;
		};
		expect(payload.resolved_env_type_id).toBe(plainEnvTypeId);
		expect(payload.resolved_env_type_name).toBe(plainEnvTypeName);
		expect(payload.secrets_enabled).toBe(false);
		expect(payload.environment.PLAIN_ONLY).toBe("plain-value");
	});

	test("exports env vars from the project file", async () => {
		const projectDir = createProjectDir({
			appName: "CLI Export Plain",
			envTypeName: plainEnvTypeName,
		});

		const result = await execCLI(cliBinary, ["export", "--format", "json"], {
			cwd: projectDir.dir,
			env: { API_KEY: apiKey },
		});

		projectDir.cleanup();

		expect(result.exitCode).toBe(0);
		const payload = JSON.parse(result.stdout) as {
			resolved_env_type_id: string;
			environment: Record<string, string>;
		};
		expect(payload.resolved_env_type_id).toBe(plainEnvTypeId);
		expect(payload.environment.PLAIN_ONLY).toBe("plain-value");
	});

	test("exports env vars plus managed secrets", async () => {
		const projectDir = createProjectDir({
			appName: "CLI Export Managed",
			envTypeName: "managed-ci",
		});

		const result = await execCLI(
			cliBinary,
			["export", "--app", "CLI Export Managed", "--env", "managed-ci", "--format", "json"],
			{
				cwd: projectDir.dir,
				env: { API_KEY: apiKey },
			},
		);

		projectDir.cleanup();

		expect(result.exitCode).toBe(0);
		const payload = JSON.parse(result.stdout) as {
			secrets_enabled: boolean;
			managed_secrets: boolean;
			environment: Record<string, string>;
		};
		expect(payload.secrets_enabled).toBe(true);
		expect(payload.managed_secrets).toBe(true);
		expect(payload.environment.SHARED_KEY).toBe("env-value");
		expect(payload.environment.MANAGED_SECRET).toBe("managed-secret-value");
	});

	test("exports env vars plus self-managed secrets with a private key file", async () => {
		const projectDir = createProjectDir({
			appName: "CLI Export Self Managed",
			envTypeName: "self-managed-ci",
		});
		const privateKeyPath = join(projectDir.dir, "self-managed-private.pem");
		writeFileSync(privateKeyPath, selfManagedPrivateKey);

		const result = await execCLI(
			cliBinary,
			[
				"export",
				"--app",
				"CLI Export Self Managed",
				"--env",
				"self-managed-ci",
				"--format",
				"json",
				"--private-key-file",
				privateKeyPath,
			],
			{
				cwd: projectDir.dir,
				env: { API_KEY: apiKey },
			},
		);

		projectDir.cleanup();

		expect(result.exitCode).toBe(0);
		const payload = JSON.parse(result.stdout) as {
			secrets_enabled: boolean;
			managed_secrets: boolean;
			environment: Record<string, string>;
		};
		expect(payload.secrets_enabled).toBe(true);
		expect(payload.managed_secrets).toBe(false);
		expect(payload.environment.SELF_ENV).toBe("self-env-value");
		expect(payload.environment.SELF_SECRET).toBe("self-secret-value");
	});

	test("fails clearly when self-managed secrets are requested without a private key", async () => {
		const projectDir = createProjectDir({
			appName: "CLI Export Self Managed",
			envTypeName: "self-managed-ci",
		});

		const result = await execCLI(
			cliBinary,
			[
				"export",
				"--app",
				"CLI Export Self Managed",
				"--env",
				"self-managed-ci",
				"--format",
				"json",
			],
			{
				cwd: projectDir.dir,
				env: { API_KEY: apiKey },
			},
		);

		projectDir.cleanup();

		expect(result.exitCode).not.toBe(0);
		expect(result.stderr).toContain("private-key-file is required");
	});

	test("fails clearly for unknown app or environment", async () => {
		const projectDir = createProjectDir({
			appName: "CLI Export Plain",
			envTypeName: plainEnvTypeName,
		});

		const unknownAppResult = await execCLI(
			cliBinary,
			["export", "--app", "missing-app", "--env", plainEnvTypeName, "--format", "json"],
			{
				cwd: projectDir.dir,
				env: { API_KEY: apiKey },
			},
		);

		const unknownEnvResult = await execCLI(
			cliBinary,
			["export", "--app", "CLI Export Plain", "--env", "does-not-exist", "--format", "json"],
			{
				cwd: projectDir.dir,
				env: { API_KEY: apiKey },
			},
		);

		projectDir.cleanup();

		expect(unknownAppResult.exitCode).not.toBe(0);
		expect(unknownAppResult.stderr).toContain("failed to resolve application");

		expect(unknownEnvResult.exitCode).not.toBe(0);
		expect(unknownEnvResult.stderr).toContain("was not found");
	});

	test("rejects the old id flags and names the replacement", async () => {
		const projectDir = createProjectDir({
			appName: "CLI Export Plain",
			envTypeName: plainEnvTypeName,
		});

		const result = await execCLI(
			cliBinary,
			["export", "--app-id", plainAppId, "--env-type-id", plainEnvTypeId, "--format", "json"],
			{
				cwd: projectDir.dir,
				env: { API_KEY: apiKey },
			},
		);

		projectDir.cleanup();

		expect(result.exitCode).not.toBe(0);
		const output = result.stderr + result.stdout;
		expect(output).toContain("use --app");
	});

	test("honors ENVSYNC_API_URL over the baked backend URL", async () => {
		const projectDir = createProjectDir({
			appName: "CLI Export Plain",
			envTypeName: plainEnvTypeName,
		});

		const result = await execCLI(
			invalidBinary,
			["export", "--app", "CLI Export Plain", "--env", plainEnvTypeName, "--format", "json"],
			{
				cwd: projectDir.dir,
				env: {
					API_KEY: apiKey,
					ENVSYNC_API_URL: serverUrl,
				},
			},
		);

		projectDir.cleanup();

		expect(result.exitCode).toBe(0);
		const payload = JSON.parse(result.stdout) as {
			environment: Record<string, string>;
		};
		expect(payload.environment.PLAIN_ONLY).toBe("plain-value");
	});
});

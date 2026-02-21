/**
 * E2E: CLI commands — auth, app lifecycle, config, gen-pem, GPG keys,
 * certificates, environment management, and run command.
 *
 * Uses real PostgreSQL, OpenFGA, and a real Bun.serve HTTP server.
 * The Go CLI binary is built with backendURL baked in via ldflags.
 *
 * Already tested elsewhere: push/pull (cli-sync.e2e.test.ts)
 * Untestable in headless CI: auth login (device flow), init (TUI),
 * environment switch (TUI), environment list (not implemented).
 */
import { beforeAll, afterAll, describe, expect, test } from "bun:test";
import { writeFileSync } from "fs";
import { join } from "path";

import { testRequest } from "../../helpers/request";
import {
	seedE2EOrg,
	checkServiceHealth,
	type E2ESeed,
} from "../helpers/real-auth";
import { startTestServer } from "../helpers/http-server";
import { buildCLI, createProjectDir, execCLI } from "../helpers/cli-runner";

let seed: E2ESeed;
let apiKey: string;
let appId: string;
let envTypeId: string;
let deletableEnvTypeId: string;
let serverUrl: string;
let stopServer: () => void;
let cliBinary: string;
let projectDir: ReturnType<typeof createProjectDir>;
let realProjectDir: ReturnType<typeof createProjectDir>;

beforeAll(async () => {
	await checkServiceHealth();
	seed = await seedE2EOrg();

	// Create an app and capture its ID
	const appRes = await testRequest("/api/app", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "CLI Commands App", description: "For CLI command tests" },
	});
	const appBody = await appRes.json<{ id: string }>();
	appId = appBody.id;

	// Create an env type for the app
	const envTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "cli-commands-env", app_id: appId },
	});
	const envTypeBody = await envTypeRes.json<{ id: string }>();
	envTypeId = envTypeBody.id;

	// Create a deletable env type for the environment delete test
	const deletableEnvTypeRes = await testRequest("/api/env_type", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "deletable-env", app_id: appId },
	});
	const deletableEnvTypeBody = await deletableEnvTypeRes.json<{ id: string }>();
	deletableEnvTypeId = deletableEnvTypeBody.id;

	// Push env vars to remote for the run command test
	await testRequest("/api/env/single", {
		method: "PUT",
		token: seed.masterUser.token,
		body: {
			app_id: appId,
			env_type_id: envTypeId,
			key: "TEST_VAR",
			value: "hello_from_envsync",
		},
	});

	// Create API key for CLI auth
	const apiKeyRes = await testRequest("/api/api_key", {
		method: "POST",
		token: seed.masterUser.token,
		body: { name: "CLI Commands Key", description: "For CLI command testing" },
	});
	const apiKeyBody = await apiKeyRes.json<{ key: string }>();
	apiKey = apiKeyBody.key;

	// Start real HTTP server
	const server = await startTestServer();
	serverUrl = server.url;
	stopServer = server.stop;

	// Build CLI binary with test server URL
	cliBinary = await buildCLI({ backendURL: serverUrl });

	// Dummy project dir for commands that don't need valid app/env config
	projectDir = createProjectDir({
		appId: "dummy",
		envTypeId: "dummy",
	});

	// Real project dir for commands that need valid app/env config (run, etc.)
	realProjectDir = createProjectDir({
		appId,
		envTypeId,
	});
});

afterAll(() => {
	stopServer?.();
	projectDir?.cleanup();
	realProjectDir?.cleanup();
});

describe("CLI Commands E2E", () => {
	// ── Existing core tests ────────────────────────────────────────────

	test("auth whoami shows user info", async () => {
		const result = await execCLI(cliBinary, ["auth", "whoami"], {
			cwd: projectDir.dir,
			env: { API_KEY: apiKey },
		});
		expect(result.exitCode).toBe(0);
		expect(result.stderr).not.toContain("panic");
		// Should display some user/org info from the API
		const output = result.stdout + result.stderr;
		expect(output).not.toContain("404");
	});

	test("app list shows apps", async () => {
		const result = await execCLI(cliBinary, ["app", "list", "--json"], {
			cwd: projectDir.dir,
			env: { API_KEY: apiKey },
		});
		expect(result.exitCode).toBe(0);
		expect(result.stderr).not.toContain("panic");
		expect(result.stdout).toContain("CLI Commands App");
	});

	test("no auth fails gracefully", async () => {
		const result = await execCLI(cliBinary, ["auth", "whoami"], {
			cwd: projectDir.dir,
			env: { API_KEY: "" },
		});
		// CLI shows a warning but exits 0 by design
		expect(result.exitCode).toBe(0);
		expect(result.stderr).not.toContain("panic");
		expect(result.stdout).not.toContain("panic");
		// Should indicate user is not logged in
		const output = result.stdout + result.stderr;
		expect(output).toContain("not logged in");
	});

	// ── Auth commands ──────────────────────────────────────────────────

	describe("Auth commands", () => {
		test("auth logout succeeds", async () => {
			const result = await execCLI(cliBinary, ["auth", "logout"], {
				cwd: projectDir.dir,
				env: { API_KEY: apiKey },
			});
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			const output = result.stdout + result.stderr;
			expect(output).toContain("Logout successful");
		});

		test("auth logout when not logged in", async () => {
			const result = await execCLI(cliBinary, ["auth", "logout"], {
				cwd: projectDir.dir,
				env: { API_KEY: "" },
			});
			// Should exit 0 even without auth
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
		});
	});

	// ── Config commands (local, no auth needed) ────────────────────────

	describe("Config commands", () => {
		test("config set updates configuration", async () => {
			const result = await execCLI(
				cliBinary,
				["config", "set", "backend_url=https://test.example.com"],
				{
					cwd: projectDir.dir,
					env: {},
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			const output = result.stdout + result.stderr;
			expect(output).toContain("Configuration updated");
		});

		test("config get retrieves a value", async () => {
			const result = await execCLI(
				cliBinary,
				["config", "get", "backend_url"],
				{
					cwd: projectDir.dir,
					env: {},
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			// Backend URL is baked in via ldflags; output should reference the key
			const output = result.stdout + result.stderr;
			expect(output).toContain("backend_url");
		});

		test("config reset resets configuration", async () => {
			const result = await execCLI(cliBinary, ["config", "reset"], {
				cwd: projectDir.dir,
				env: {},
			});
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			const output = result.stdout + result.stderr;
			expect(output).toContain("reset");
		});
	});

	// ── Gen-PEM (local, no auth needed) ────────────────────────────────

	describe("Gen-PEM", () => {
		test("gen-pem generates PEM key pair", async () => {
			const result = await execCLI(cliBinary, ["gen-pem"], {
				cwd: projectDir.dir,
				env: {},
			});
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			const output = result.stdout + result.stderr;
			expect(output).toContain("PEM key pair generated");
		});
	});

	// ── App lifecycle (--json bypasses TUI) ────────────────────────────

	describe("App lifecycle", () => {
		test("app create creates an app", async () => {
			const result = await execCLI(
				cliBinary,
				[
					"app",
					"create",
					"--name",
					"E2E CLI Created",
					"--description",
					"test",
					"--json",
				],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			expect(result.stdout).toContain("E2E CLI Created");
		});

		test("app delete deletes an app", async () => {
			const result = await execCLI(
				cliBinary,
				["app", "delete", "--name", "E2E CLI Created", "--json"],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			const output = result.stdout + result.stderr;
			expect(output).toContain("deleted");
		});
	});

	// ── GPG key management (sequential — each test builds on previous) ─

	describe("GPG key management", () => {
		let gpgKeyId: string;

		test("gpg generate creates a GPG key", async () => {
			const result = await execCLI(
				cliBinary,
				[
					"gpg",
					"generate",
					"--name",
					"E2E Key",
					"--email",
					"e2e@test.local",
					"--json",
				],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			const json = JSON.parse(result.stdout);
			gpgKeyId = json.id;
			expect(gpgKeyId).toBeTruthy();
		});

		test("gpg list shows GPG keys", async () => {
			const result = await execCLI(
				cliBinary,
				["gpg", "list", "--json"],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			expect(result.stdout).toContain("E2E Key");
		});

		test("gpg export exports public key", async () => {
			const result = await execCLI(
				cliBinary,
				["gpg", "export", "--key-id", gpgKeyId, "--json"],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			expect(result.stdout).toContain("public_key");
		});

		test("gpg sign signs a file", async () => {
			const testFile = join(realProjectDir.dir, "test-sign.txt");
			const sigFile = join(realProjectDir.dir, "test-sign.txt.sig");
			writeFileSync(testFile, "Hello from EnvSync E2E tests\n");

			const result = await execCLI(
				cliBinary,
				[
					"gpg",
					"sign",
					"--key-id",
					gpgKeyId,
					"--file",
					testFile,
					"--output",
					sigFile,
				],
				{
					cwd: realProjectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
		});

		test("gpg verify verifies a signature", async () => {
			const testFile = join(realProjectDir.dir, "test-sign.txt");
			const sigFile = join(realProjectDir.dir, "test-sign.txt.sig");

			const result = await execCLI(
				cliBinary,
				[
					"gpg",
					"verify",
					"--file",
					testFile,
					"--signature",
					sigFile,
					"--key-id",
					gpgKeyId,
					"--json",
				],
				{
					cwd: realProjectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
		});

		test("gpg revoke revokes a key", async () => {
			const result = await execCLI(
				cliBinary,
				["gpg", "revoke", "--key-id", gpgKeyId, "--json"],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			const output = result.stdout + result.stderr;
			expect(output).toContain("revoked");
		});

		test("gpg delete deletes a key", async () => {
			const result = await execCLI(
				cliBinary,
				["gpg", "delete", "--key-id", gpgKeyId, "--json"],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			const output = result.stdout + result.stderr;
			expect(output).toContain("deleted");
		});
	});

	// ── Certificate management (sequential — CA init must come first) ──

	describe("Certificate management", () => {
		let certSerial: string;

		test("cert ca init initializes CA", async () => {
			const result = await execCLI(
				cliBinary,
				[
					"cert",
					"ca",
					"init",
					"--org-name",
					"E2E Test Org",
					"--json",
				],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
		});

		test("cert ca status shows CA status", async () => {
			const result = await execCLI(
				cliBinary,
				["cert", "ca", "status", "--json"],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
		});

		test("cert issue issues a certificate", async () => {
			const result = await execCLI(
				cliBinary,
				[
					"cert",
					"issue",
					"--email",
					"dev@e2e.local",
					"--role",
					"developer",
					"--json",
				],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			const json = JSON.parse(result.stdout);
			certSerial = json.serial_hex || json.serial;
			expect(certSerial).toBeTruthy();
		});

		test("cert list lists certificates", async () => {
			const result = await execCLI(
				cliBinary,
				["cert", "list", "--json"],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
		});

		test("cert root-ca exports root CA", async () => {
			const result = await execCLI(
				cliBinary,
				["cert", "root-ca", "--json"],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			expect(result.stdout).toContain("cert_pem");
		});

		test("cert crl exports CRL", async () => {
			const result = await execCLI(
				cliBinary,
				["cert", "crl", "--json"],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
		});

		test("cert ocsp checks certificate status", async () => {
			const result = await execCLI(
				cliBinary,
				["cert", "ocsp", "--serial", certSerial, "--json"],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
		});

		test("cert revoke revokes a certificate", async () => {
			const result = await execCLI(
				cliBinary,
				["cert", "revoke", "--serial", certSerial, "--json"],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
		});
	});

	// ── Environment management ─────────────────────────────────────────

	describe("Environment management", () => {
		test("environment delete deletes an env type", async () => {
			const result = await execCLI(
				cliBinary,
				["environment", "delete", "--id", deletableEnvTypeId, "--json"],
				{
					cwd: projectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			const output = result.stdout + result.stderr;
			expect(output).toContain("deleted");
		});
	});

	// ── Run command ────────────────────────────────────────────────────

	describe("Run command", () => {
		test("run executes command with injected env vars", async () => {
			const result = await execCLI(
				cliBinary,
				["run", "--command", "printenv TEST_VAR"],
				{
					cwd: realProjectDir.dir,
					env: { API_KEY: apiKey },
				},
			);
			expect(result.exitCode).toBe(0);
			expect(result.stderr).not.toContain("panic");
			expect(result.stdout).toContain("[REDACTED]");
		});
	});
});

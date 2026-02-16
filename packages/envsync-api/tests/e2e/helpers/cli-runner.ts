/**
 * CLI E2E test helpers — build the Go CLI binary, create project fixtures,
 * and execute CLI commands in isolated temp directories.
 *
 * Uses async Bun.spawn (not spawnSync) because spawnSync deadlocks inside
 * bun test when a Bun.serve HTTP server is running in the same process.
 */
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const MONOREPO_ROOT = join(import.meta.dir, "..", "..", "..", "..", "..");
const CLI_PACKAGE = join(MONOREPO_ROOT, "packages", "envsync-cli");

let cachedBinaryPath: string | null = null;
let cachedBackendURL: string | null = null;

/**
 * Build the CLI binary with a custom backendURL baked in via ldflags.
 * Caches the binary path so subsequent calls skip the build.
 */
export async function buildCLI({
	backendURL,
}: { backendURL: string }): Promise<string> {
	if (cachedBinaryPath && cachedBackendURL === backendURL)
		return cachedBinaryPath;

	const output = join(mkdtempSync(join(tmpdir(), "envsync-cli-")), "envsync");
	const ldflags = `-X github.com/EnvSync-Cloud/envsync-cli/internal/config.backendURL=${backendURL}`;

	const proc = Bun.spawn(
		["go", "build", `-ldflags=${ldflags}`, "-o", output, "./cmd/cli/main.go"],
		{
			cwd: CLI_PACKAGE,
			env: { ...process.env, CGO_ENABLED: "0" },
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`CLI build failed (exit ${exitCode}): ${stderr}`);
	}

	cachedBinaryPath = output;
	cachedBackendURL = backendURL;
	return output;
}

/**
 * Create a temporary project directory with .env and envsyncrc.toml files.
 */
export function createProjectDir({
	appId,
	envTypeId,
	envVars = {},
}: {
	appId: string;
	envTypeId: string;
	envVars?: Record<string, string>;
}): {
	dir: string;
	envPath: string;
	configPath: string;
	cleanup: () => void;
} {
	const dir = mkdtempSync(join(tmpdir(), "envsync-project-"));

	// Write envsyncrc.toml
	const configPath = join(dir, "envsyncrc.toml");
	writeFileSync(
		configPath,
		`app_id = "${appId}"\nenv_type_id = "${envTypeId}"\n`,
	);

	// Write .env file
	const envPath = join(dir, ".env");
	const envContent = Object.entries(envVars)
		.map(([k, v]) => `${k}=${v}`)
		.join("\n");
	writeFileSync(envPath, envContent ? envContent + "\n" : "");

	return {
		dir,
		envPath,
		configPath,
		cleanup: () => rmSync(dir, { recursive: true, force: true }),
	};
}

/**
 * Execute the CLI binary with the given arguments in an isolated environment.
 * HOME and XDG_CONFIG_HOME are set to a temp dir so CLI config doesn't
 * pollute the user's machine.
 */
export async function execCLI(
	binaryPath: string,
	args: string[],
	options: {
		cwd: string;
		env?: Record<string, string>;
	},
): Promise<{
	exitCode: number;
	stdout: string;
	stderr: string;
}> {
	// Create isolated config directory
	const fakeHome = mkdtempSync(join(tmpdir(), "envsync-home-"));
	mkdirSync(join(fakeHome, ".config", "envsync"), { recursive: true });

	const proc = Bun.spawn([binaryPath, ...args], {
		cwd: options.cwd,
		env: {
			...process.env,
			...options.env,
			HOME: fakeHome,
			XDG_CONFIG_HOME: join(fakeHome, ".config"),
		},
		stdout: "pipe",
		stderr: "pipe",
	});

	const exitCode = await proc.exited;
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();

	// Clean up fake home
	rmSync(fakeHome, { recursive: true, force: true });

	return {
		exitCode: exitCode ?? 1,
		stdout,
		stderr,
	};
}

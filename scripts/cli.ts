#!/usr/bin/env bun
/**
 * EnvSync CLI – full init from project root.
 * 1. Ensure .env exists (copy from .env.example)
 * 2. Start Docker Compose services (without envsync_api)
 * 3. Wait for postgres, Zitadel, RustFS, Vault, OpenFGA
 * 4. Initialize & configure Vault (KV v2, AppRole auth)
 * 5. Initialize OpenFGA (create store, write authorization model)
 * 6. Run DB migrations
 * 7. Run API init (RustFS bucket; Zitadel apps created in console, secrets in .env)
 *
 * Run from monorepo root: bun run scripts/cli.ts init
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";

import { authorizationModelDef } from "../packages/envsync-api/src/libs/openfga/model";
import {
	loadEnvFile,
	updateEnvFile,
	waitFor,
	waitForPostgres,
	waitForVault,
	waitForOpenFGA,
	waitForZitadel,
	waitForGrafana,
	readPatFromVolume,
	initVault,
} from "./lib/services";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

/** Update or add keys in the root .env; then reload into process.env. */
function updateRootEnvAndReload(updates: Record<string, string>): void {
	const envPath = path.join(rootDir, ".env");
	updateEnvFile(envPath, updates);
	loadEnvFile(envPath);
}


function askReinitEnv(): Promise<boolean> {
	return new Promise(resolve => {
		if (!process.stdin.isTTY) {
			resolve(false);
			return;
		}
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
		rl.question(".env already exists. Re-initialize? (y)es: delete and recreate, (n)o: skip [N]: ", answer => {
			rl.close();
			resolve(/^y(es)?$/i.test(answer.trim()));
		});
	});
}

async function ensureEnv(): Promise<void> {
	const envPath = path.join(rootDir, ".env");
	const examplePath = path.join(rootDir, ".env.example");
	if (!fs.existsSync(examplePath)) {
		throw new Error(".env.example not found at repo root.");
	}
	if (fs.existsSync(envPath)) {
		const reinit = await askReinitEnv();
		if (reinit) {
			fs.unlinkSync(envPath);
			fs.copyFileSync(examplePath, envPath);
			console.log("Recreated .env from .env.example.");
		} else {
			console.log(".env already exists, skipping.");
		}
		return;
	}
	fs.copyFileSync(examplePath, envPath);
	console.log("Created .env from .env.example.");
}

function dockerUp(): void {
	console.log("\nStarting Docker Compose (postgres, redis, rustfs, mailpit, zitadel, vault, openfga, otel)...");
	const result = spawnSync(
		"docker",
		[
			"compose",
			"up",
			"-d",
			"postgres",
			"redis",
			"rustfs",
			"mailpit",
			"zitadel",
			"vault-init",
			"vault",
			"openfga_db",
			"openfga_migrate",
			"openfga",
			"minikms_db",
			"minikms_migrate",
			"minikms",
			"tempo",
			"loki",
			"prometheus",
			"otel-collector",
			"grafana",
			"httpbin",
			"hdx",
		],
		{ cwd: rootDir, stdio: "inherit", env: process.env },
	);
	if (result.status !== 0) throw new Error("Docker Compose up failed.");
}



async function waitForRustfs(): Promise<void> {
	const endpoint =
		process.env.S3_ENDPOINT ??
		`http://localhost:${process.env.RUSTFS_HTTP_PORT ?? process.env.RUSTFS_PORT ?? "19001"}`;
	let host: string;
	let port: number;
	try {
		const u = new URL(endpoint);
		host = u.hostname;
		port = u.port ? parseInt(u.port, 10) : u.protocol === "https:" ? 443 : 80;
	} catch {
		return;
	}
	await waitFor(
		"RustFS (S3)",
		() =>
			new Promise<boolean>(resolve => {
				const s = net.createConnection(port, host, () => {
					s.destroy();
					resolve(true);
				});
				s.on("error", () => resolve(false));
				s.setTimeout(2000, () => {
					s.destroy();
					resolve(false);
				});
			}),
		2000,
		25,
	);
}


/** Initialize Vault and save credentials to root .env. */
async function initVaultAndSave(): Promise<void> {
	const vaultPort = process.env.VAULT_PORT ?? "8200";
	const vaultAddr = process.env.VAULT_ADDR ?? `http://localhost:${vaultPort}`;
	const mountPath = process.env.VAULT_MOUNT_PATH || "envsync";

	const result = await initVault(vaultAddr, mountPath);
	updateRootEnvAndReload({
		VAULT_ADDR: result.vaultAddr,
		VAULT_TOKEN: result.rootToken,
		VAULT_UNSEAL_KEY: result.unsealKey,
		VAULT_ROLE_ID: result.roleId,
		VAULT_SECRET_ID: result.secretId,
		VAULT_MOUNT_PATH: result.mountPath,
	});
	console.log("  Vault credentials saved to .env (VAULT_ADDR, VAULT_TOKEN, VAULT_ROLE_ID, VAULT_SECRET_ID, VAULT_MOUNT_PATH).");
}

/**
 * Initialize OpenFGA for EnvSync:
 * 1. Create a store (if OPENFGA_STORE_ID is not already set)
 * 2. Write the authorization model
 * 3. Save OPENFGA_STORE_ID and OPENFGA_MODEL_ID to .env
 */
async function initOpenFGA(): Promise<void> {
	const openfgaUrl = (
		process.env.OPENFGA_API_URL ?? `http://localhost:${process.env.OPENFGA_HTTP_PORT ?? "8090"}`
	).replace(/\/$/, "");

	console.log(`\nInitializing OpenFGA at ${openfgaUrl}...`);

	// If already configured, skip
	if (process.env.OPENFGA_STORE_ID && process.env.OPENFGA_MODEL_ID) {
		console.log(
			`  OpenFGA already configured (store=${process.env.OPENFGA_STORE_ID}, model=${process.env.OPENFGA_MODEL_ID}). Skipping.`,
		);
		return;
	}

	// ── Step 1: Create store ─────────────────────────────────────────
	let storeId = process.env.OPENFGA_STORE_ID || "";
	if (!storeId) {
		console.log("  Creating OpenFGA store 'envsync'...");
		const storeRes = await fetch(`${openfgaUrl}/stores`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "envsync" }),
			signal: AbortSignal.timeout(10000),
		});
		if (!storeRes.ok) {
			throw new Error(`Failed to create OpenFGA store (${storeRes.status}): ${await storeRes.text()}`);
		}
		const storeData = (await storeRes.json()) as { id: string; name: string };
		storeId = storeData.id;
		console.log(`  Store created: ${storeId}`);
	} else {
		console.log(`  Using existing store: ${storeId}`);
	}

	// ── Step 2: Write authorization model ────────────────────────────
	console.log("  Writing authorization model...");
	const modelRes = await fetch(`${openfgaUrl}/stores/${storeId}/authorization-models`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(authorizationModelDef),
		signal: AbortSignal.timeout(10000),
	});
	if (!modelRes.ok) {
		throw new Error(
			`Failed to write OpenFGA authorization model (${modelRes.status}): ${await modelRes.text()}`,
		);
	}
	const modelData = (await modelRes.json()) as { authorization_model_id: string };
	const modelId = modelData.authorization_model_id;
	console.log(`  Authorization model written: ${modelId}`);

	// ── Step 3: Save to .env ─────────────────────────────────────────
	updateRootEnvAndReload({
		OPENFGA_API_URL: openfgaUrl,
		OPENFGA_STORE_ID: storeId,
		OPENFGA_MODEL_ID: modelId,
	});
	console.log("  OpenFGA credentials saved to .env (OPENFGA_API_URL, OPENFGA_STORE_ID, OPENFGA_MODEL_ID).");
}

function runMigrations(): void {
	console.log("\nRunning DB migrations...");
	const result = spawnSync(process.execPath, ["run", "scripts/migrate.ts", "latest"], {
		cwd: path.join(rootDir, "packages/envsync-api"),
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) throw new Error("DB migrations failed.");
}

function runApiInit(): void {
	console.log("\nRunning RustFS init (and optional Zitadel app setup)...");
	const result = spawnSync(process.execPath, ["run", "scripts/cli.ts", "init"], {
		cwd: path.join(rootDir, "packages/envsync-api"),
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) throw new Error("API init failed.");
}

async function init(): Promise<void> {
	console.log("EnvSync full init (env, Docker, migrations, Zitadel, RustFS, Vault, OpenFGA)\n");

	await ensureEnv();
	loadEnvFile(path.join(rootDir, ".env"));

	dockerUp();

	console.log("\nWaiting for services (Zitadel can take 1–2 min on first start)...");
	await new Promise(r => setTimeout(r, 10000));
	await waitForPostgres();
	await waitForZitadel();
	await waitForRustfs();
	await waitForVault();
	await waitForOpenFGA();

	const patFromVolume = await readPatFromVolume(rootDir);
	if (patFromVolume) {
		updateRootEnvAndReload({ ZITADEL_PAT: patFromVolume });
		console.log("Zitadel: PAT read from docker volume and saved to .env (continuing with updated env).");
	}

	await initVaultAndSave();
	await initOpenFGA();

	// Wait for Grafana (dashboards are auto-provisioned)
	await waitForGrafana();

	runMigrations();
	runApiInit();

	console.log("\nStopping Docker services...");
	dockerDown();
	console.log("\nAll set. Start services with: bun run cli services up. Then start the API with: bun run dev (or docker compose up envsync_api).");
}

function dockerDown(): void {
	const result = spawnSync("docker", ["compose", "down"], {
		cwd: rootDir,
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) throw new Error("Docker Compose down failed.");
}

function runDb(args: string[]): void {
	const result = spawnSync(process.execPath, ["run", "scripts/migrate.ts", ...args], {
		cwd: path.join(rootDir, "packages/envsync-api"),
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) throw new Error("DB command failed.");
}

function servicesUp(): void {
	console.log("Starting Docker Compose services...");
	const result = spawnSync(
		"docker",
		[
			"compose",
			"up",
			"-d",
			"postgres",
			"redis",
			"rustfs",
			"mailpit",
			"zitadel",
			"vault-init",
			"vault",
			"zitadel_login",
			"openfga_db",
			"openfga_migrate",
			"openfga",
			"minikms_db",
			"minikms_migrate",
			"minikms",
			"tempo",
			"loki",
			"prometheus",
			"otel-collector",
			"grafana",
			"httpbin",
			"hdx",
		],
		{ cwd: rootDir, stdio: "inherit", env: process.env },
	);
	if (result.status !== 0) throw new Error("Docker Compose up failed.");
}

function servicesDown(): void {
	console.log("Stopping Docker Compose services...");
	const result = spawnSync("docker", ["compose", "down"], {
		cwd: rootDir,
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) throw new Error("Docker Compose down failed.");
}

function servicesStatus(): void {
	const result = spawnSync("docker", ["compose", "ps"], {
		cwd: rootDir,
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) throw new Error("Docker Compose ps failed.");
}

// ── HyperDX helpers ─────────────────────────────────────────────────

function hyperdxUp(): void {
	console.log("Starting HyperDX...");
	const result = spawnSync("docker", ["compose", "up", "-d", "hdx"], {
		cwd: rootDir,
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) throw new Error("HyperDX docker compose up failed.");
}

function hyperdxDown(): void {
	console.log("Stopping HyperDX...");
	const result = spawnSync("docker", ["compose", "stop", "hdx"], {
		cwd: rootDir,
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) throw new Error("HyperDX docker compose stop failed.");
}

async function hyperdxInit(): Promise<void> {
	// Remove hdx container and its volumes
	spawnSync("docker", ["compose", "rm", "-sf", "hdx"], {
		cwd: rootDir,
		stdio: "inherit",
		env: process.env,
	});
	spawnSync("docker", ["volume", "rm", "-f", "monorepo_hdx_data", "monorepo_hdx_ch_data", "monorepo_hdx_ch_logs"], {
		cwd: rootDir,
		stdio: "inherit",
		env: process.env,
	});

	console.log("Initializing HyperDX stack...");
	const result = spawnSync("docker", ["compose", "up", "-d", "hdx"], {
		cwd: rootDir,
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) throw new Error("HyperDX docker compose init failed.");

	const hdxPort = Number(process.env.HDX_PORT || "8800");
	await waitFor(
		"HyperDX",
		() =>
			new Promise<boolean>(resolve => {
				const s = net.createConnection(hdxPort, "localhost", () => {
					s.destroy();
					resolve(true);
				});
				s.on("error", () => resolve(false));
				s.setTimeout(2000, () => {
					s.destroy();
					resolve(false);
				});
			}),
		2000,
		25,
	);

	console.log("HyperDX is ready.");

	// wait for service to be fully ready
	await new Promise(r => setTimeout(r, 5000));

	// Register a new user
	const registerResult = await fetch(`http://localhost:${hdxPort}/api/register/password`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email: "dev@envsync.local", password: "TestDev@1234", confirmPassword: "TestDev@1234" }),
	});
	if (!registerResult.ok) {
		throw new Error(`Failed to register HyperDX user (${registerResult.status}): ${await registerResult.text()}`);
	}
	const registerData = (await registerResult.json()) as { status: string };
	console.log(`HyperDX user registered: ${registerData.status}`);
	console.log(`  Email:    dev@envsync.local`);
	console.log(`  Password: TestDev@1234`);
}
function printUsage(): void {
	console.log("Usage: bun run cli <command> [options]");
	console.log("");
	console.log("Commands:");
	console.log("  init              Full init: .env, Docker up, wait, Vault setup, OpenFGA setup, migrations, API init, then Docker down");
	console.log("  db <migrate-cmd>  Run DB migrations (packages/envsync-api/scripts/migrate.ts)");
	console.log("                    e.g. db latest | db list | db rollback | db backup | db restore | db migrate_to <name> | db step | db drop | db init");
	console.log("  services <sub>    Docker Compose: up | down | status");
	console.log("  hyperdx <sub>     HyperDX session replay: init | up | down");
	console.log("");
}

const cmd = process.argv[2];
if (cmd === "init") {
	init().catch(err => {
		console.error(err);
		process.exit(1);
	});
} else if (cmd === "db") {
	loadEnvFile(path.join(rootDir, ".env"));
	const dbArgs = process.argv.slice(3);
	if (dbArgs.length === 0) {
		console.log("Usage: bun run cli db <migrate-cmd>");
		console.log("  e.g. latest | list | rollback | backup | restore | migrate_to <name> | step | drop | init");
		process.exit(1);
	}
	runDb(dbArgs);
} else if (cmd === "services") {
	const sub = process.argv[3];
	if (sub === "up") servicesUp();
	else if (sub === "down") servicesDown();
	else if (sub === "status") servicesStatus();
	else {
		console.log("Usage: bun run cli services <up|down|status>");
		process.exit(sub ? 1 : 0);
	}
} else if (cmd === "hyperdx") {
	const sub = process.argv[3];
	if (sub === "init") hyperdxInit();
	else if (sub === "up") hyperdxUp();
	else if (sub === "down") hyperdxDown();
	else {
		console.log("Usage: bun run cli hyperdx <init|up|down>");
		process.exit(sub ? 1 : 0);
	}
} else {
	printUsage();
	process.exit(cmd ? 1 : 0);
}

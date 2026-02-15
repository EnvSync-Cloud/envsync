#!/usr/bin/env bun
/**
 * EnvSync CLI – full init from project root.
 * 1. Ensure .env exists (copy from .env.example)
 * 2. Start Docker Compose services (without envsync_api)
 * 3. Wait for postgres, Zitadel, RustFS, Vault
 * 4. Initialize & configure Vault (KV v2, AppRole auth)
 * 5. Run DB migrations
 * 6. Run API init (RustFS bucket; Zitadel apps created in console, secrets in .env)
 *
 * Run from monorepo root: bun run scripts/cli.ts init
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

function loadEnvFile(filePath: string): void {
	if (!fs.existsSync(filePath)) return;
	const content = fs.readFileSync(filePath, "utf8");
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1).replace(/\\"/g, '"');
		}
		if (key) process.env[key] = value;
	}
}

/** Update or add keys in the root .env; then reload into process.env. */
function updateRootEnvAndReload(updates: Record<string, string>): void {
	if (Object.keys(updates).length === 0) return;
	const envPath = path.join(rootDir, ".env");
	const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
	const lines = content.split(/\r?\n/);
	const keyToLineIndex = new Map<string, number>();
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const eq = line.indexOf("=");
		if (eq > 0) {
			const key = line.slice(0, eq).trim();
			if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) keyToLineIndex.set(key, i);
		}
	}
	for (const [key, value] of Object.entries(updates)) {
		const escaped = value.includes(" ") || value.includes("#") ? `"${value.replace(/"/g, '\\"')}"` : value;
		if (keyToLineIndex.has(key)) {
			lines[keyToLineIndex.get(key)!] = `${key}=${escaped}`;
		} else {
			lines.push(`${key}=${escaped}`);
		}
	}
	fs.writeFileSync(envPath, lines.join("\n") + (lines.length ? "\n" : ""), "utf8");
	loadEnvFile(envPath);
}

/** Read Zitadel admin PAT from the zitadel_data Docker volume (admin.pat from first-instance machine user). */
async function readPatFromVolume(): Promise<string | null> {
	const projectName = process.env.COMPOSE_PROJECT_NAME ?? path.basename(rootDir);
	const volumeName = `${projectName}_zitadel_data`;
	const maxAttempts = 5;
	const delayMs = 4000;
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const result = spawnSync(
			"docker",
			["run", "--rm", "-v", `${volumeName}:/data:ro`, "alpine", "cat", "/data/admin.pat"],
			{ cwd: rootDir, encoding: "utf8", env: process.env },
		);
		if (result.status === 0 && result.stdout?.trim()) {
			return result.stdout.trim();
		}
		if (attempt < maxAttempts) {
			console.log(`Zitadel: PAT not ready yet (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs / 1000}s...`);
			await new Promise(r => setTimeout(r, delayMs));
		}
	}
	return null;
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
	console.log("\nStarting Docker Compose (postgres, redis, rustfs, mailpit, zitadel, vault)...");
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
		],
		{ cwd: rootDir, stdio: "inherit", env: process.env },
	);
	if (result.status !== 0) throw new Error("Docker Compose up failed.");
}

function waitFor(
	label: string,
	check: () => Promise<boolean>,
	intervalMs: number,
	maxAttempts: number,
): Promise<void> {
	return new Promise((resolve, reject) => {
		let attempts = 0;
		const run = async () => {
			try {
				if (await check()) {
					console.log(`${label} is ready.`);
					return resolve();
				}
			} catch (_) {}
			attempts++;
			if (attempts >= maxAttempts) return reject(new Error(`${label} did not become ready in time.`));
			setTimeout(run, intervalMs);
		};
		run();
	});
}

async function waitForPostgres(): Promise<void> {
	const host = process.env.DATABASE_HOST ?? "localhost";
	const port = parseInt(process.env.DATABASE_PORT ?? "5432", 10);
	await waitFor(
		"Postgres",
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
		30,
	);
}

async function waitForZitadel(): Promise<void> {
	const base = (process.env.ZITADEL_URL ?? "http://localhost:8080").replace(/\/$/, "");
	// When running from host, ZITADEL_URL in .env might be http://zitadel:8080; try localhost for port check
	const checkUrl = base.includes("zitadel:") ? "http://localhost:8080" : base;
	await waitFor(
		"Zitadel",
		async () => {
			try {
				const res = await fetch(`${checkUrl}/.well-known/openid-configuration`, {
					signal: AbortSignal.timeout(5000),
				});
				return res.ok;
			} catch {
				return false;
			}
		},
		5000,
		60,
	);
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

async function waitForVault(): Promise<void> {
	const vaultAddr = (process.env.VAULT_ADDR ?? `http://localhost:${process.env.VAULT_PORT ?? "8200"}`).replace(/\/$/, "");
	await waitFor(
		"Vault",
		async () => {
			try {
				// Vault health endpoint returns 200 (initialized+unsealed), 429 (unsealed+standby),
				// 472 (DR secondary), 473 (perf standby), 501 (not initialized), 503 (sealed)
				// Any response means Vault is reachable
				const res = await fetch(`${vaultAddr}/v1/sys/health`, {
					signal: AbortSignal.timeout(3000),
				});
				return res.status !== undefined;
			} catch {
				return false;
			}
		},
		3000,
		30,
	);
}

/**
 * Initialize and configure Vault for EnvSync:
 * 1. Check if Vault is initialized; if not, initialize with 1 key share / 1 threshold (dev)
 * 2. Unseal if sealed
 * 3. Enable KV v2 secrets engine at "envsync/"
 * 4. Enable AppRole auth method
 * 5. Create policy + role for the API
 * 6. Generate role_id and secret_id
 * 7. Save all credentials to root .env
 */
async function initVault(): Promise<void> {
	const vaultPort = process.env.VAULT_PORT ?? "8200";
	const vaultAddr = (process.env.VAULT_ADDR ?? `http://localhost:${vaultPort}`).replace(/\/$/, "");
	const mountPath = process.env.VAULT_MOUNT_PATH || "envsync";

	console.log(`\nInitializing Vault at ${vaultAddr}...`);

	// Helper for Vault API calls
	async function vaultFetch(path: string, opts: RequestInit = {}): Promise<Response> {
		return fetch(`${vaultAddr}${path}`, {
			...opts,
			headers: {
				"Content-Type": "application/json",
				...(rootToken ? { "X-Vault-Token": rootToken } : {}),
				...(opts.headers || {}),
			},
			signal: AbortSignal.timeout(10000),
		});
	}

	let rootToken = process.env.VAULT_TOKEN || "";
	let unsealKey = process.env.VAULT_UNSEAL_KEY || "";

	// ── Step 1: Check initialization status ──────────────────────────
	const initRes = await vaultFetch("/v1/sys/init");
	const { initialized } = (await initRes.json()) as { initialized: boolean };

	if (!initialized) {
		console.log("  Vault is not initialized. Initializing (1 key share, 1 threshold for dev)...");
		const initResp = await vaultFetch("/v1/sys/init", {
			method: "PUT",
			body: JSON.stringify({ secret_shares: 1, secret_threshold: 1 }),
		});
		if (!initResp.ok) {
			throw new Error(`Vault init failed (${initResp.status}): ${await initResp.text()}`);
		}
		const initData = (await initResp.json()) as {
			keys: string[];
			keys_base64: string[];
			root_token: string;
		};
		rootToken = initData.root_token;
		unsealKey = initData.keys_base64[0] || initData.keys[0] || "";
		console.log("  Vault initialized. Root token and unseal key obtained.");

		// Save root token and unseal key immediately
		updateRootEnvAndReload({ VAULT_TOKEN: rootToken, VAULT_UNSEAL_KEY: unsealKey });
	} else {
		console.log("  Vault is already initialized.");
		if (!rootToken) {
			console.log("  WARNING: VAULT_TOKEN not set. If Vault is sealed, unseal will fail.");
			console.log("  Set VAULT_TOKEN in .env if you have the root token.");
		}
	}

	// ── Step 2: Check seal status and unseal if needed ───────────────
	const healthRes = await vaultFetch("/v1/sys/health");
	if (healthRes.status === 503) {
		// Sealed
		if (!unsealKey) {
			throw new Error(
				"Vault is sealed but no unseal key is available. " +
				"Set VAULT_UNSEAL_KEY in .env and re-run init.",
			);
		}
		console.log("  Vault is sealed. Unsealing...");
		const unsealRes = await vaultFetch("/v1/sys/unseal", {
			method: "PUT",
			body: JSON.stringify({ key: unsealKey }),
		});
		if (!unsealRes.ok) {
			throw new Error(`Vault unseal failed (${unsealRes.status}): ${await unsealRes.text()}`);
		}
		console.log("  Vault unsealed.");
	} else if (healthRes.status === 200 || healthRes.status === 429) {
		console.log("  Vault is unsealed and ready.");
	}

	if (!rootToken) {
		console.log("  Skipping Vault configuration (no root token). Set VAULT_TOKEN and re-run init.");
		return;
	}

	// ── Step 3: Enable KV v2 secrets engine ──────────────────────────
	console.log(`  Enabling KV v2 secrets engine at "${mountPath}/"...`);
	const mountRes = await vaultFetch(`/v1/sys/mounts/${mountPath}`, {
		method: "POST",
		body: JSON.stringify({ type: "kv", options: { version: "2" } }),
	});
	if (mountRes.ok) {
		console.log(`  KV v2 engine enabled at "${mountPath}/".`);
	} else if (mountRes.status === 400) {
		const body = await mountRes.text();
		if (body.includes("existing mount")) {
			console.log(`  KV v2 engine already mounted at "${mountPath}/".`);
		} else {
			throw new Error(`Failed to enable KV v2: ${body}`);
		}
	} else {
		throw new Error(`Failed to enable KV v2 (${mountRes.status}): ${await mountRes.text()}`);
	}

	// ── Step 4: Enable AppRole auth method ───────────────────────────
	console.log("  Enabling AppRole auth method...");
	const authRes = await vaultFetch("/v1/sys/auth/approle", {
		method: "POST",
		body: JSON.stringify({ type: "approle" }),
	});
	if (authRes.ok) {
		console.log("  AppRole auth method enabled.");
	} else if (authRes.status === 400) {
		const body = await authRes.text();
		if (body.includes("existing mount")) {
			console.log("  AppRole auth method already enabled.");
		} else {
			throw new Error(`Failed to enable AppRole: ${body}`);
		}
	} else {
		throw new Error(`Failed to enable AppRole (${authRes.status}): ${await authRes.text()}`);
	}

	// ── Step 5: Create policy for EnvSync API ────────────────────────
	console.log("  Creating Vault policy 'envsync-api'...");
	const policy = `
# Allow full CRUD on the envsync KV v2 secrets engine
path "${mountPath}/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "${mountPath}/metadata/*" {
  capabilities = ["read", "delete", "list"]
}
path "${mountPath}/delete/*" {
  capabilities = ["update"]
}
path "${mountPath}/undelete/*" {
  capabilities = ["update"]
}
path "${mountPath}/destroy/*" {
  capabilities = ["update"]
}
# Allow token self-renewal
path "auth/token/renew-self" {
  capabilities = ["update"]
}
# Allow health check
path "sys/health" {
  capabilities = ["read"]
}
`.trim();

	const policyRes = await vaultFetch("/v1/sys/policy/envsync-api", {
		method: "PUT",
		body: JSON.stringify({ policy }),
	});
	if (!policyRes.ok) {
		throw new Error(`Failed to create policy (${policyRes.status}): ${await policyRes.text()}`);
	}
	console.log("  Policy 'envsync-api' created.");

	// ── Step 6: Create AppRole role ──────────────────────────────────
	console.log("  Creating AppRole role 'envsync-api'...");
	const roleRes = await vaultFetch("/v1/auth/approle/role/envsync-api", {
		method: "POST",
		body: JSON.stringify({
			token_policies: ["envsync-api"],
			token_ttl: "1h",
			token_max_ttl: "4h",
			secret_id_ttl: "0",
			secret_id_num_uses: 0,
		}),
	});
	if (!roleRes.ok) {
		throw new Error(`Failed to create AppRole role (${roleRes.status}): ${await roleRes.text()}`);
	}
	console.log("  AppRole role 'envsync-api' created.");

	// ── Step 7: Get role_id ──────────────────────────────────────────
	const roleIdRes = await vaultFetch("/v1/auth/approle/role/envsync-api/role-id");
	if (!roleIdRes.ok) {
		throw new Error(`Failed to get role_id (${roleIdRes.status}): ${await roleIdRes.text()}`);
	}
	const { data: roleIdData } = (await roleIdRes.json()) as { data: { role_id: string } };
	const roleId = roleIdData.role_id;
	console.log(`  Role ID: ${roleId}`);

	// ── Step 8: Generate secret_id ───────────────────────────────────
	const secretIdRes = await vaultFetch("/v1/auth/approle/role/envsync-api/secret-id", {
		method: "POST",
		body: JSON.stringify({}),
	});
	if (!secretIdRes.ok) {
		throw new Error(`Failed to generate secret_id (${secretIdRes.status}): ${await secretIdRes.text()}`);
	}
	const { data: secretIdData } = (await secretIdRes.json()) as { data: { secret_id: string } };
	const secretId = secretIdData.secret_id;
	console.log(`  Secret ID: ${secretId.slice(0, 8)}...`);

	// ── Step 9: Save to .env ─────────────────────────────────────────
	updateRootEnvAndReload({
		VAULT_ADDR: vaultAddr,
		VAULT_TOKEN: rootToken,
		VAULT_ROLE_ID: roleId,
		VAULT_SECRET_ID: secretId,
		VAULT_MOUNT_PATH: mountPath,
	});
	console.log("  Vault credentials saved to .env (VAULT_ADDR, VAULT_TOKEN, VAULT_ROLE_ID, VAULT_SECRET_ID, VAULT_MOUNT_PATH).");
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
	console.log("EnvSync full init (env, Docker, migrations, Zitadel, RustFS, Vault)\n");

	await ensureEnv();
	loadEnvFile(path.join(rootDir, ".env"));

	dockerUp();

	console.log("\nWaiting for services (Zitadel can take 1–2 min on first start)...");
	await new Promise(r => setTimeout(r, 10000));
	await waitForPostgres();
	await waitForZitadel();
	await waitForRustfs();
	await waitForVault();

	const patFromVolume = await readPatFromVolume();
	if (patFromVolume) {
		updateRootEnvAndReload({ ZITADEL_PAT: patFromVolume });
		console.log("Zitadel: PAT read from docker volume and saved to .env (continuing with updated env).");
	}

	await initVault();

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
			"zitadel_login"
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

function printUsage(): void {
	console.log("Usage: bun run cli <command> [options]");
	console.log("");
	console.log("Commands:");
	console.log("  init              Full init: .env, Docker up, wait, Vault setup, migrations, API init, then Docker down");
	console.log("  db <migrate-cmd>  Run DB migrations (packages/envsync-api/scripts/migrate.ts)");
	console.log("                    e.g. db latest | db list | db rollback | db backup | db restore | db migrate_to <name> | db step | db drop | db init");
	console.log("  services <sub>    Docker Compose: up | down | status");
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
} else {
	printUsage();
	process.exit(cmd ? 1 : 0);
}

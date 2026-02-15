#!/usr/bin/env bun
/**
 * EnvSync CLI – full init from project root.
 * 1. Ensure .env exists (copy from .env.example)
 * 2. Start Docker Compose services (without envsync_api)
 * 3. Wait for postgres, Zitadel, RustFS
 * 4. Run DB migrations
 * 5. Run API init (RustFS bucket; Zitadel apps created in console, secrets in .env)
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
	console.log("EnvSync full init (env, Docker, migrations, Zitadel, RustFS)\n");

	await ensureEnv();
	loadEnvFile(path.join(rootDir, ".env"));

	dockerUp();

	console.log("\nWaiting for services (Zitadel can take 1–2 min on first start)...");
	await new Promise(r => setTimeout(r, 10000));
	await waitForPostgres();
	await waitForZitadel();
	await waitForRustfs();

	const patFromVolume = await readPatFromVolume();
	if (patFromVolume) {
		updateRootEnvAndReload({ ZITADEL_PAT: patFromVolume });
		console.log("Zitadel: PAT read from docker volume and saved to .env (continuing with updated env).");
	}

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
			"vault",
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
	console.log("  init              Full init: .env, Docker up, wait, migrations, API init, then Docker down");
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

#!/usr/bin/env bun
/**
 * EnvSync CLI – full init from project root.
 * 1. Ensure .env exists (copy from .env.example)
 * 2. Start Docker Compose services (without envsync_api)
 * 3. Wait for Keycloak, RustFS, SpacetimeDB
 * 4. Run API init (RustFS bucket; Keycloak clients)
 *
 * Run from monorepo root: bun run scripts/cli.ts init
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";

import {
	loadEnvFile,
	updateEnvFile,
	waitFor,
	waitForKeycloak,
	waitForSpacetimeDB,
	waitForGrafana,
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

function dockerUp(dbLocal: boolean): void {
	const services = [
		"keycloak_db",
		"keycloak",
		"redis",
		"rustfs",
		"mailpit",
		"tempo",
		"loki",
		"prometheus",
		"otel-collector",
		"grafana",
		"httpbin",
		"hdx",
	];
	const args = ["compose"];
	if (dbLocal) {
		args.push("--profile", "stdb");
		services.push("spacetimedb", "stdb_publish");
	}
	args.push("up", "-d", ...services);

	const label = dbLocal ? "keycloak, redis, rustfs, mailpit, spacetimedb, otel" : "keycloak, redis, rustfs, mailpit, otel (stdb: cloud)";
	console.log(`\nStarting Docker Compose (${label})...`);
	const result = spawnSync("docker", args, { cwd: rootDir, stdio: "inherit", env: process.env });
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


function runApiInit(): void {
	console.log("\nRunning RustFS init (and Keycloak client setup)...");
	const result = spawnSync(process.execPath, ["run", "scripts/cli.ts", "init"], {
		cwd: path.join(rootDir, "packages/envsync-api"),
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) throw new Error("API init failed.");
}

async function init(dbLocal: boolean): Promise<void> {
	console.log(`EnvSync full init (env, Docker, Keycloak, RustFS${dbLocal ? ", SpacetimeDB" : " — stdb: cloud"})\n`);

	await ensureEnv();
	loadEnvFile(path.join(rootDir, ".env"));

	dockerUp(dbLocal);

	console.log("\nWaiting for services (Keycloak can take 1–2 min on first start)...");
	await new Promise(r => setTimeout(r, 10000));
	await waitForKeycloak();
	await waitForRustfs();
	// if (dbLocal) await waitForSpacetimeDB();

	// Wait for Grafana (dashboards are auto-provisioned)
	await waitForGrafana();

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

function servicesUp(dbLocal: boolean): void {
	const services = [
		"keycloak_db",
		"keycloak",
		"redis",
		"rustfs",
		"mailpit",
		"tempo",
		"loki",
		"prometheus",
		"otel-collector",
		"grafana",
		"httpbin",
		"hdx",
	];
	const args = ["compose"];
	if (dbLocal) {
		args.push("--profile", "stdb");
		services.push("spacetimedb", "stdb_publish");
	}
	args.push("up", "-d", ...services);

	console.log(`Starting Docker Compose services${dbLocal ? " (with local SpacetimeDB)" : " (stdb: cloud)"}...`);
	const result = spawnSync("docker", args, { cwd: rootDir, stdio: "inherit", env: process.env });
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
	console.log("  init [--db-local]       Full init: .env, Docker up, wait, Keycloak setup, API init, then Docker down");
	console.log("                          --db-local  Spin up self-hosted SpacetimeDB (default: use cloud)");
	console.log("  services <sub>          Docker Compose: up [--db-local] | down | status");
	console.log("  hyperdx <sub>           HyperDX session replay: init | up | down");
	console.log("");
}

const cmd = process.argv[2];
const dbLocal = process.argv.includes("--db-local");
if (cmd === "init") {
	init(dbLocal).catch(err => {
		console.error(err);
		process.exit(1);
	});
} else if (cmd === "services") {
	const sub = process.argv[3];
	if (sub === "up") servicesUp(dbLocal);
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

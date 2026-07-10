#!/usr/bin/env bun
/**
 * E2E Test Environment Manager.
 *
 * Subcommands:
 *   init    — Start docker services, wait for health, create e2e database,
 *             write .env.e2e.test
 *   reset   — Fully reset docker/data state, then run init
 *   cleanup — Drop e2e database, remove .env.e2e.test
 *
 * Usage:
 *   bun run scripts/e2e-setup.ts init
 *   bun run scripts/e2e-setup.ts reset
 *   bun run scripts/e2e-setup.ts cleanup
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
	loadEnvFile,
	updateEnvFile,
	waitForPostgres,
	waitForOpenFGA,
	waitForMailpit,
	waitForKeycloak,
	waitForMiniKMS,
} from "./lib/services";
import { bootstrapKeycloakClient } from "../packages/envsync-api/tests/e2e/helpers/keycloak-bootstrap";
import { authorizationModelDef } from "../packages/envsync-api/src/libs/openfga/model";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const apiDir = path.join(rootDir, "packages/envsync-api");
const envE2EPath = path.join(apiDir, ".env.e2e.test");

const E2E_DB_NAME = "envsync_e2e_test";
const E2E_MINIKMS_ROOT_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const E2E_COMPOSE_UP_ATTEMPTS = Number(process.env.ENVSYNC_E2E_COMPOSE_UP_ATTEMPTS ?? "3");
const E2E_ENV_OVERRIDE_KEYS = [
	"DATABASE_HOST",
	"DATABASE_PORT",
	"DATABASE_USER",
	"DATABASE_PASSWORD",
	"POSTGRES_PORT",
	"REDIS_PORT",
	"KEYCLOAK_PORT",
	"KEYCLOAK_URL",
	"KEYCLOAK_REALM",
	"KEYCLOAK_ADMIN_USER",
	"KEYCLOAK_ADMIN_PASSWORD",
	"OPENFGA_HTTP_PORT",
	"OPENFGA_GRPC_PORT",
	"OPENFGA_API_URL",
	"MAILPIT_PORT",
	"MAILPIT_SMTP_PORT",
	"MINIKMS_DB_PORT",
	"MINIKMS_GRPC_PORT",
	"CLICKSTACK_PORT",
	"CLICKSTACK_OTEL_GRPC_PORT",
	"CLICKSTACK_OTEL_HTTP_PORT",
	"OTEL_AGENT_OTLP_GRPC_PORT",
	"OTEL_AGENT_OTLP_HTTP_PORT",
	"OTEL_EXPORTER_OTLP_ENDPOINT",
];

function sleepMs(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function restoreExplicitEnvOverrides(keys: string[]): () => void {
	const explicitValues = new Map<string, string>();
	for (const key of keys) {
		const value = process.env[key];
		if (value !== undefined) explicitValues.set(key, value);
	}

	return () => {
		for (const [key, value] of explicitValues) {
			process.env[key] = value;
		}
	};
}

function loadRootEnvPreservingOverrides(): void {
	const restoreOverrides = restoreExplicitEnvOverrides(E2E_ENV_OVERRIDE_KEYS);
	const rootEnvPath = path.join(rootDir, ".env");
	if (fs.existsSync(rootEnvPath)) {
		loadEnvFile(rootEnvPath);
	}
	restoreOverrides();
}

// ── Docker Compose helpers ──────────────────────────────────────────

function dockerComposeBuildKeycloak(): void {
	console.log("\nBuilding local Keycloak image for E2E...");
	const result = spawnSync(
		"docker",
		["compose", "build", "keycloak"],
		{ cwd: rootDir, stdio: "inherit", env: process.env },
	);
	if (result.status !== 0) throw new Error("Docker Compose build for Keycloak failed.");
}

function dockerComposeUp(): void {
	process.env.MINIKMS_ROOT_KEY ||= E2E_MINIKMS_ROOT_KEY;
	const composeUpArgs = [
		"compose",
		"up",
		"-d",
		"postgres",
		"redis",
		"dynamic_secret_db",
		"openfga_db",
		"openfga_migrate",
		"openfga",
		"mailpit",
		"keycloak_db",
		"keycloak",
		"minikms_db",
		"minikms_migrate",
		"minikms",
		"clickstack",
		"otel-agent",
	];

	for (let attempt = 1; attempt <= E2E_COMPOSE_UP_ATTEMPTS; attempt += 1) {
		console.log(`\nStarting Docker Compose services for E2E (attempt ${attempt}/${E2E_COMPOSE_UP_ATTEMPTS})...`);
		const result = spawnSync("docker", composeUpArgs, { cwd: rootDir, stdio: "inherit", env: process.env });
		if (result.status === 0) return;

		if (attempt < E2E_COMPOSE_UP_ATTEMPTS) {
			console.log("Docker Compose up failed. Cleaning partial services before retry...");
			spawnSync("docker", ["compose", "down", "--remove-orphans"], { cwd: rootDir, stdio: "inherit", env: process.env });
			sleepMs(5_000 * attempt);
		}
	}

	spawnSync("docker", ["compose", "down", "--remove-orphans"], { cwd: rootDir, stdio: "inherit", env: process.env });
	throw new Error(`Docker Compose up failed after ${E2E_COMPOSE_UP_ATTEMPTS} attempts.`);
}

function dockerComposeExec(service: string, args: string[], opts: { stdio?: "inherit" | "pipe"; encoding?: BufferEncoding } = {}) {
	return spawnSync(
		"docker",
		["compose", "exec", "-T", service, ...args],
		{ cwd: rootDir, env: process.env, stdio: opts.stdio ?? "inherit", encoding: opts.encoding },
	);
}

function dockerComposeRestart(service: string): void {
	const result = spawnSync("docker", ["compose", "restart", service], {
		cwd: rootDir,
		stdio: "inherit",
		env: process.env,
	});
	if (result.status !== 0) {
		throw new Error(`Failed to restart ${service}.`);
	}
}

function ensureKeycloakHttpAdminSupport(adminUser: string, adminPassword: string): void {
	console.log("\nConfiguring Keycloak admin realm for local HTTP...");
	const login = dockerComposeExec(
		"keycloak",
		[
			"/opt/keycloak/bin/kcadm.sh",
			"config",
			"credentials",
			"--server",
			"http://localhost:8080",
			"--realm",
			"master",
			"--user",
			adminUser,
			"--password",
			adminPassword,
		],
	);
	if (login.status !== 0) {
		throw new Error("Failed to authenticate to Keycloak via kcadm.");
	}

	const update = dockerComposeExec(
		"keycloak",
		[
			"/opt/keycloak/bin/kcadm.sh",
			"update",
			"realms/master",
			"-s",
			"sslRequired=NONE",
		],
	);
	if (update.status !== 0) {
		throw new Error("Failed to relax Keycloak master realm SSL requirement for local E2E.");
	}
}

function ensureMiniKmsSchema(): void {
	console.log("\nEnsuring miniKMS schema...");

	const check = dockerComposeExec(
		"minikms_db",
		[
			"psql",
			"-U",
			process.env.MINIKMS_DB_USER ?? "postgres",
			"-d",
			"minikms",
			"-tAc",
			"SELECT to_regclass('public.certificates') IS NOT NULL",
		],
		{ stdio: "pipe", encoding: "utf8" },
	);

	if (check.status === 0 && (check.stdout as string).trim() === "t") {
		console.log("  miniKMS schema already present.");
		return;
	}

	const migrate = spawnSync(
		"docker",
		["compose", "run", "--rm", "minikms_migrate"],
		{ cwd: rootDir, stdio: "inherit", env: process.env },
	);
	if (migrate.status !== 0) {
		throw new Error("miniKMS migration failed.");
	}

	dockerComposeRestart("minikms");
}

async function initOpenFGA(apiUrl: string): Promise<{ storeId: string; modelId: string }> {
	console.log("\nBootstrapping OpenFGA store for E2E...");

	const storeRes = await fetch(`${apiUrl}/stores`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: `envsync-e2e-${Date.now()}` }),
	});
	if (!storeRes.ok) {
		throw new Error(`OpenFGA store create failed: ${storeRes.status} ${await storeRes.text()}`);
	}
	const store = (await storeRes.json()) as { id: string };

	const modelRes = await fetch(`${apiUrl}/stores/${store.id}/authorization-models`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(authorizationModelDef),
	});
	if (!modelRes.ok) {
		throw new Error(
			`OpenFGA model write failed: ${modelRes.status} ${await modelRes.text()}`,
		);
	}
	const model = (await modelRes.json()) as { authorization_model_id: string };

	console.log(`  Store: ${store.id}`);
	console.log(`  Model: ${model.authorization_model_id}`);

	return { storeId: store.id, modelId: model.authorization_model_id };
}

// ── Database helpers ────────────────────────────────────────────────

function createE2EDatabase(): void {
	const host = process.env.DATABASE_HOST ?? "localhost";
	const port = process.env.DATABASE_PORT ?? "5432";
	const user = process.env.DATABASE_USER ?? "postgres";

	console.log(`\nCreating E2E database '${E2E_DB_NAME}'...`);

	// Check if database already exists
	const checkResult = spawnSync(
		"psql",
		["-h", host, "-p", port, "-U", user, "-tAc", `SELECT 1 FROM pg_database WHERE datname='${E2E_DB_NAME}'`],
		{ encoding: "utf8", env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD ?? "postgres" } },
	);

	if (checkResult.stdout?.trim() === "1") {
		console.log(`  Database '${E2E_DB_NAME}' already exists.`);
		return;
	}

	const result = spawnSync(
		"createdb",
		["-h", host, "-p", port, "-U", user, E2E_DB_NAME],
		{ stdio: "inherit", env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD ?? "postgres" } },
	);
	if (result.status !== 0) {
		throw new Error(`Failed to create database '${E2E_DB_NAME}'.`);
	}
	console.log(`  Database '${E2E_DB_NAME}' created.`);
}

function dropE2EDatabase(): void {
	const host = process.env.DATABASE_HOST ?? "localhost";
	const port = process.env.DATABASE_PORT ?? "5432";
	const user = process.env.DATABASE_USER ?? "postgres";

	console.log(`\nDropping E2E database '${E2E_DB_NAME}'...`);

	const result = spawnSync(
		"dropdb",
		["-h", host, "-p", port, "-U", user, "--if-exists", E2E_DB_NAME],
		{ stdio: "inherit", env: { ...process.env, PGPASSWORD: process.env.DATABASE_PASSWORD ?? "postgres" } },
	);
	if (result.status !== 0) {
		console.log(`  Warning: Failed to drop database '${E2E_DB_NAME}' (may not exist).`);
	} else {
		console.log(`  Database '${E2E_DB_NAME}' dropped.`);
	}
}

// ── Init ────────────────────────────────────────────────────────────

async function init(): Promise<void> {
	console.log("E2E Environment Setup\n");

	// Load root .env for docker-compose port overrides
	loadRootEnvPreservingOverrides();
	process.env.MINIKMS_ROOT_KEY ||= E2E_MINIKMS_ROOT_KEY;

	// Start docker services
	dockerComposeBuildKeycloak();
	dockerComposeUp();

	// Wait for services
	console.log("\nWaiting for services...");
	await new Promise(r => setTimeout(r, 3000));
	await waitForPostgres();
	await waitForOpenFGA();
	await waitForMailpit();
	await waitForKeycloak();
	await waitForMiniKMS();

	const keycloakUrl = process.env.KEYCLOAK_URL ?? "http://localhost:8080";
	const keycloakRealm = process.env.KEYCLOAK_REALM ?? "envsync";
	const keycloakAdminUser = process.env.KEYCLOAK_ADMIN_USER ?? "admin";
	const keycloakAdminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD ?? "admin";

	ensureKeycloakHttpAdminSupport(keycloakAdminUser, keycloakAdminPassword);
	ensureMiniKmsSchema();

	console.log("\nBootstrapping Keycloak client for E2E...");
	const keycloakClient = await bootstrapKeycloakClient(
		keycloakUrl,
		keycloakRealm,
		keycloakAdminUser,
		keycloakAdminPassword,
	);
	console.log(`  Client: ${keycloakClient.clientId}`);

	// Create E2E database
	createE2EDatabase();

	// Resolve OpenFGA URL
	const openfgaUrl = (
		process.env.OPENFGA_API_URL ?? `http://localhost:${process.env.OPENFGA_HTTP_PORT ?? "8090"}`
	).replace(/\/$/, "");
	const openfga = await initOpenFGA(openfgaUrl);

	// Write .env.e2e.test
	const e2eEnv: Record<string, string> = {
		MINIKMS_ROOT_KEY: process.env.MINIKMS_ROOT_KEY,
		MINIKMS_GRPC_ADDR: `localhost:${process.env.MINIKMS_GRPC_PORT ?? "50051"}`,
		MINIKMS_TLS_ENABLED: "false",
		OPENFGA_API_URL: openfgaUrl,
		OPENFGA_STORE_ID: openfga.storeId,
		OPENFGA_MODEL_ID: openfga.modelId,
		KEYCLOAK_URL: keycloakUrl,
		KEYCLOAK_REALM: keycloakRealm,
		KEYCLOAK_ADMIN_USER: keycloakAdminUser,
		KEYCLOAK_ADMIN_PASSWORD: keycloakAdminPassword,
		KEYCLOAK_WEB_CLIENT_ID: process.env.KEYCLOAK_WEB_CLIENT_ID ?? "envsync-web",
		KEYCLOAK_WEB_CLIENT_SECRET: process.env.KEYCLOAK_WEB_CLIENT_SECRET ?? "test-web-client-secret",
		KEYCLOAK_CLI_CLIENT_ID: process.env.KEYCLOAK_CLI_CLIENT_ID ?? "envsync-cli",
		KEYCLOAK_API_CLIENT_ID: process.env.KEYCLOAK_API_CLIENT_ID ?? "envsync-api",
		KEYCLOAK_API_CLIENT_SECRET: process.env.KEYCLOAK_API_CLIENT_SECRET ?? "test-api-client-secret",
		KEYCLOAK_WEB_REDIRECT_URI: process.env.KEYCLOAK_WEB_REDIRECT_URI ?? "http://api.lvh.me:4000/api/access/web/callback",
		KEYCLOAK_WEB_CALLBACK_URL: process.env.KEYCLOAK_WEB_CALLBACK_URL ?? "http://app.lvh.me:8001/auth/callback",
		KEYCLOAK_API_REDIRECT_URI: process.env.KEYCLOAK_API_REDIRECT_URI ?? "http://api.lvh.me:4000/api/access/api/callback",
		KEYCLOAK_E2E_CLIENT_ID: keycloakClient.clientId,
		KEYCLOAK_E2E_CLIENT_SECRET: keycloakClient.clientSecret,
		LANDING_PAGE_URL: process.env.LANDING_PAGE_URL ?? "http://localhost:8002",
		DASHBOARD_URL: process.env.DASHBOARD_URL ?? "http://app.lvh.me:8001",
		OTEL_EXPORTER_OTLP_ENDPOINT:
			process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? `http://localhost:${process.env.OTEL_AGENT_OTLP_HTTP_PORT ?? "14318"}`,
		OTEL_SERVICE_NAME: "envsync-api",
		DYNAMIC_SECRET_PG_HOST: process.env.DYNAMIC_SECRET_PG_HOST ?? "localhost",
		DYNAMIC_SECRET_PG_PORT: process.env.DYNAMIC_SECRET_PG_PORT ?? "5433",
		DYNAMIC_SECRET_PG_USER: process.env.DYNAMIC_SECRET_PG_USER ?? "dynroot",
		DYNAMIC_SECRET_PG_PASSWORD: process.env.DYNAMIC_SECRET_PG_PASSWORD ?? "dynrootpass",
		DYNAMIC_SECRET_PG_DATABASE: process.env.DYNAMIC_SECRET_PG_DATABASE ?? "dynamic_secrets",
	};

	updateEnvFile(envE2EPath, e2eEnv);
	console.log(`\n.env.e2e.test written to ${envE2EPath}`);

	console.log("\nE2E environment setup complete!");
	console.log("Run tests with: cd packages/envsync-api && bun run test:e2e");
}

// ── Cleanup ─────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
	console.log("E2E Environment Cleanup\n");

	// Load root .env for database connection info
	loadRootEnvPreservingOverrides();

	// Drop E2E database
	dropE2EDatabase();

	// Remove .env.e2e.test
	if (fs.existsSync(envE2EPath)) {
		fs.unlinkSync(envE2EPath);
		console.log(`Removed ${envE2EPath}`);
	} else {
		console.log(`.env.e2e.test not found (already removed?).`);
	}

	console.log("\nE2E cleanup complete!");
}

// ── Reset ───────────────────────────────────────────────────────────

function dockerComposeDown(): void {
	console.log("\nStopping Docker Compose services for fresh E2E reset...");
	spawnSync(
		"docker",
		["compose", "down", "-v", "--remove-orphans"],
		{ cwd: rootDir, stdio: "inherit", env: process.env },
	);
}

async function reset(): Promise<void> {
	console.log("E2E Environment Reset\n");
	dockerComposeDown();
	await cleanup();
	await init();
}

// ── CLI ─────────────────────────────────────────────────────────────

const cmd = process.argv[2];
if (cmd === "init") {
	init().catch(err => {
		console.error(err);
		process.exit(1);
	});
} else if (cmd === "reset") {
	reset().catch(err => {
		console.error(err);
		process.exit(1);
	});
} else if (cmd === "cleanup") {
	cleanup().catch(err => {
		console.error(err);
		process.exit(1);
	});
} else {
	console.log("Usage: bun run scripts/e2e-setup.ts <init|reset|cleanup>");
	process.exit(cmd ? 1 : 0);
}

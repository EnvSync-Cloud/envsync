#!/usr/bin/env bun
/**
 * E2E Test Environment Manager.
 *
 * Subcommands:
 *   init    — Start docker services, wait for health, create e2e database,
 *             initialize Vault (KV v2 + AppRole), write .env.e2e.test
 *   cleanup — Drop e2e database, remove .env.e2e.test
 *
 * Usage:
 *   bun run scripts/e2e-setup.ts init
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
	waitForVault,
	waitForOpenFGA,
	waitForMailpit,
	waitForZitadel,
	readPatFromVolume,
	readLoginPatFromVolume,
	initVault,
} from "./lib/services";
import { bootstrapZitadelProject } from "../packages/envsync-api/tests/e2e/helpers/zitadel-bootstrap";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const apiDir = path.join(rootDir, "packages/envsync-api");
const envE2EPath = path.join(apiDir, ".env.e2e.test");

const E2E_DB_NAME = "envsync_e2e_test";

// ── Docker Compose helpers ──────────────────────────────────────────

function dockerComposeUp(): void {
	console.log("\nStarting Docker Compose services for E2E...");
	const result = spawnSync(
		"docker",
		[
			"compose",
			"up",
			"-d",
			"postgres",
			"redis",
			"vault-init",
			"vault",
			"openfga_db",
			"openfga_migrate",
			"openfga",
			"mailpit",
			"zitadel_db",
			"zitadel",
		],
		{ cwd: rootDir, stdio: "inherit", env: process.env },
	);
	if (result.status !== 0) throw new Error("Docker Compose up failed.");
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
	const rootEnvPath = path.join(rootDir, ".env");
	if (fs.existsSync(rootEnvPath)) {
		loadEnvFile(rootEnvPath);
	}

	// Start docker services
	dockerComposeUp();

	// Wait for services
	console.log("\nWaiting for services...");
	await new Promise(r => setTimeout(r, 3000));
	await waitForPostgres();
	await waitForVault();
	await waitForOpenFGA();
	await waitForMailpit();
	await waitForZitadel();

	// Read Zitadel PATs
	const zitadelUrl = "http://localhost:8080";
	const adminPatFromVolume = await readPatFromVolume(rootDir);
	if (!adminPatFromVolume) {
		throw new Error("Failed to read Zitadel admin PAT from Docker volume. Is Zitadel running?");
	}
	const loginPatFromVolume = await readLoginPatFromVolume(rootDir);
	const effectiveLoginPat = loginPatFromVolume || adminPatFromVolume;
	if (!loginPatFromVolume) {
		console.log("Zitadel: login-client.pat not found; falling back to admin PAT for login flow.");
	}
	console.log("Zitadel: PAT(s) read from docker volume.");

	// Bootstrap Zitadel project + OIDC app for E2E
	console.log("\nBootstrapping Zitadel project + OIDC app for E2E...");
	const zitadelApp = await bootstrapZitadelProject(zitadelUrl, adminPatFromVolume);
	console.log(`  Project: ${zitadelApp.projectId}, Client: ${zitadelApp.appClientId}`);

	// Create E2E database
	createE2EDatabase();

	// Initialize Vault with E2E-specific policy/role
	const vaultPort = process.env.VAULT_PORT ?? "8200";
	const vaultAddr = process.env.VAULT_ADDR ?? `http://localhost:${vaultPort}`;
	const mountPath = "envsync";

	const vaultResult = await initVault(vaultAddr, mountPath, "envsync-e2e", "envsync-e2e");

	// Resolve OpenFGA URL
	const openfgaUrl = (
		process.env.OPENFGA_API_URL ?? `http://localhost:${process.env.OPENFGA_HTTP_PORT ?? "8090"}`
	).replace(/\/$/, "");

	// Write .env.e2e.test
	const e2eEnv: Record<string, string> = {
		VAULT_ADDR: vaultResult.vaultAddr,
		VAULT_ROLE_ID: vaultResult.roleId,
		VAULT_SECRET_ID: vaultResult.secretId,
		VAULT_MOUNT_PATH: vaultResult.mountPath,
		VAULT_TOKEN: vaultResult.rootToken,
		VAULT_UNSEAL_KEY: vaultResult.unsealKey,
		OPENFGA_API_URL: openfgaUrl,
		ZITADEL_URL: zitadelUrl,
		ZITADEL_PAT: adminPatFromVolume,
		ZITADEL_LOGIN_PAT: effectiveLoginPat,
		ZITADEL_E2E_CLIENT_ID: zitadelApp.appClientId,
		ZITADEL_E2E_CLIENT_SECRET: zitadelApp.appClientSecret,
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
	const rootEnvPath = path.join(rootDir, ".env");
	if (fs.existsSync(rootEnvPath)) {
		loadEnvFile(rootEnvPath);
	}

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

// ── CLI ─────────────────────────────────────────────────────────────

const cmd = process.argv[2];
if (cmd === "init") {
	init().catch(err => {
		console.error(err);
		process.exit(1);
	});
} else if (cmd === "cleanup") {
	cleanup().catch(err => {
		console.error(err);
		process.exit(1);
	});
} else {
	console.log("Usage: bun run scripts/e2e-setup.ts <init|cleanup>");
	process.exit(cmd ? 1 : 0);
}

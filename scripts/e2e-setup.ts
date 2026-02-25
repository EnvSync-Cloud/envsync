#!/usr/bin/env bun
/**
 * E2E Test Environment Manager.
 *
 * Subcommands:
 *   init    — Start docker services, wait for health, retrieve Keycloak
 *             client secrets, write .env.e2e.test
 *   cleanup — Remove .env.e2e.test
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
	waitForKeycloak,
	waitForSpacetimeDB,
	waitForMailpit,
	waitForGrafana,
} from "./lib/services";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const apiDir = path.join(rootDir, "packages/envsync-api");
const envE2EPath = path.join(apiDir, ".env.e2e.test");

// ── Docker Compose helpers ──────────────────────────────────────────

function dockerComposeUp(): void {
	console.log("\nStarting Docker Compose services for E2E...");
	const result = spawnSync(
		"docker",
		[
			"compose",
			"up",
			"-d",
			"spacetimedb",
			"stdb_publish",
			"redis",
			"keycloak_db",
			"keycloak",
			"rustfs",
			"mailpit",
			"tempo",
			"loki",
			"prometheus",
			"otel-collector",
			"grafana",
		],
		{ cwd: rootDir, stdio: "inherit", env: process.env },
	);
	if (result.status !== 0) throw new Error("Docker Compose up failed.");
}

// ── Keycloak helpers ────────────────────────────────────────────────

interface KeycloakE2EResult {
	webClientId: string;
	webClientSecret: string;
	cliClientId: string;
	apiClientId: string;
	apiClientSecret: string;
}

async function retrieveKeycloakClients(keycloakUrl: string): Promise<KeycloakE2EResult> {
	const realm = process.env.KEYCLOAK_REALM ?? "envsync";
	const adminUser = process.env.KEYCLOAK_ADMIN_USER ?? "admin";
	const adminPass = process.env.KEYCLOAK_ADMIN_PASSWORD ?? "admin";

	console.log("\nRetrieving Keycloak client secrets...");

	// Get admin token
	const tokenRes = await fetch(
		`${keycloakUrl}/realms/master/protocol/openid-connect/token`,
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "password",
				client_id: "admin-cli",
				username: adminUser,
				password: adminPass,
			}),
			signal: AbortSignal.timeout(10_000),
		},
	);
	if (!tokenRes.ok) {
		throw new Error(`Keycloak admin token failed: ${tokenRes.status} ${await tokenRes.text()}`);
	}
	const { access_token: token } = (await tokenRes.json()) as { access_token: string };
	console.log("  Admin token acquired.");

	async function adminFetch(apiPath: string, opts: RequestInit = {}): Promise<Response> {
		return fetch(`${keycloakUrl}/admin/realms/${realm}${apiPath}`, {
			...opts,
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				...(opts.headers as Record<string, string>),
			},
			signal: opts.signal ?? AbortSignal.timeout(10_000),
		});
	}

	async function getClientSecret(clientId: string): Promise<{ id: string; secret: string }> {
		const listRes = await adminFetch(`/clients?clientId=${encodeURIComponent(clientId)}`);
		if (!listRes.ok) throw new Error(`Keycloak list clients failed: ${listRes.status}`);
		const clients = (await listRes.json()) as Array<{ id: string; clientId: string; publicClient?: boolean }>;
		const client = clients.find(c => c.clientId === clientId);
		if (!client) throw new Error(`Keycloak client '${clientId}' not found. Ensure realm-export.json was imported.`);

		if (client.publicClient) {
			return { id: client.id, secret: "" };
		}

		const secretRes = await adminFetch(`/clients/${client.id}/client-secret`);
		if (!secretRes.ok) throw new Error(`Keycloak get secret failed: ${secretRes.status}`);
		const data = (await secretRes.json()) as { value: string };
		return { id: client.id, secret: data.value };
	}

	const webClientId = process.env.KEYCLOAK_WEB_CLIENT_ID ?? "envsync-web";
	const cliClientId = process.env.KEYCLOAK_CLI_CLIENT_ID ?? "envsync-cli";
	const apiClientId = process.env.KEYCLOAK_API_CLIENT_ID ?? "envsync-api";

	const web = await getClientSecret(webClientId);
	console.log(`  Web client: ${webClientId} (secret: ${web.secret ? web.secret.slice(0, 8) + "..." : "public"})`);

	const cli = await getClientSecret(cliClientId);
	console.log(`  CLI client: ${cliClientId} (${cli.secret ? "confidential" : "public"})`);

	const api = await getClientSecret(apiClientId);
	console.log(`  API client: ${apiClientId} (secret: ${api.secret ? api.secret.slice(0, 8) + "..." : "public"})`);

	return {
		webClientId,
		webClientSecret: web.secret,
		cliClientId,
		apiClientId,
		apiClientSecret: api.secret,
	};
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
	await waitForKeycloak();
	await waitForSpacetimeDB();
	await waitForMailpit();
	await waitForGrafana();

	// Retrieve Keycloak client secrets (clients are auto-imported via realm-export.json)
	const keycloakPort = process.env.KEYCLOAK_PORT ?? "8080";
	const keycloakUrl = process.env.KEYCLOAK_URL ?? `http://localhost:${keycloakPort}`;
	// Normalize: if the URL uses the Docker-internal hostname, use localhost for host access
	const keycloakHostUrl = keycloakUrl.includes("keycloak:") ? `http://localhost:${keycloakPort}` : keycloakUrl;
	const keycloakResult = await retrieveKeycloakClients(keycloakHostUrl.replace(/\/$/, ""));

	// Resolve service URLs for env output
	const keycloakRealm = process.env.KEYCLOAK_REALM ?? "envsync";
	const keycloakAdminUser = process.env.KEYCLOAK_ADMIN_USER ?? "admin";
	const keycloakAdminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD ?? "admin";
	const redisUrl = process.env.REDIS_URL ?? `redis://localhost:${process.env.REDIS_PORT ?? "6379"}`;
	const stdbUrl = process.env.STDB_URL ?? `http://localhost:${process.env.STDB_PORT ?? "1234"}`;

	// Write .env.e2e.test
	const e2eEnv: Record<string, string> = {
		KEYCLOAK_URL: keycloakHostUrl.replace(/\/$/, ""),
		KEYCLOAK_REALM: keycloakRealm,
		KEYCLOAK_ADMIN_USER: keycloakAdminUser,
		KEYCLOAK_ADMIN_PASSWORD: keycloakAdminPassword,
		KEYCLOAK_WEB_CLIENT_ID: keycloakResult.webClientId,
		KEYCLOAK_WEB_CLIENT_SECRET: keycloakResult.webClientSecret,
		KEYCLOAK_CLI_CLIENT_ID: keycloakResult.cliClientId,
		KEYCLOAK_API_CLIENT_ID: keycloakResult.apiClientId,
		KEYCLOAK_API_CLIENT_SECRET: keycloakResult.apiClientSecret,
		REDIS_URL: redisUrl,
		STDB_URL: stdbUrl.replace(/\/$/, ""),
		OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
		OTEL_SERVICE_NAME: "envsync-api",
	};

	updateEnvFile(envE2EPath, e2eEnv);
	console.log(`\n.env.e2e.test written to ${envE2EPath}`);

	console.log("\nE2E environment setup complete!");
	console.log("Run tests with: cd packages/envsync-api && bun run test:e2e");
}

// ── Cleanup ─────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
	console.log("E2E Environment Cleanup\n");

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

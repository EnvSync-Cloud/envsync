#!/usr/bin/env bun
/**
 * Production one-shot init script for EnvSync.
 *
 * Bootstraps all infrastructure services on first deployment:
 *   1. Keycloak: verify realm exists, retrieve client secrets
 *   2. SpacetimeDB: health check
 *   3. RustFS: create S3 bucket
 *   4. HyperDX: register default user
 *
 * Usage (inside Docker):
 *   docker compose -f docker-compose.prod.yaml run --rm envsync_init
 *
 * All generated credentials are printed to stdout at the end.
 * Copy them into your .env / Dokploy env panel before starting the API.
 *
 * This script is intentionally self-contained and does NOT import the main
 * app's config (src/utils/env) because Zod validation would fail — many
 * required env vars don't exist yet during first-time bootstrap.
 */

import net from "node:net";
import { randomBytes } from "node:crypto";

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";

// ── Env helpers ─────────────────────────────────────────────────────

function requireEnv(key: string): string {
	const val = process.env[key];
	if (!val) throw new Error(`Required env var ${key} is not set`);
	return val;
}

function optionalEnv(key: string, fallback = ""): string {
	return process.env[key] || fallback;
}

// ── Wait-for utilities ──────────────────────────────────────────────

async function waitFor(
	label: string,
	check: () => Promise<boolean>,
	intervalMs: number,
	maxAttempts: number,
): Promise<void> {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			if (await check()) {
				console.log(`  ${label} is ready.`);
				return;
			}
		} catch {}
		if (attempt >= maxAttempts) {
			throw new Error(`${label} did not become ready after ${maxAttempts} attempts.`);
		}
		console.log(`  Waiting for ${label}... (${attempt}/${maxAttempts})`);
		await new Promise(r => setTimeout(r, intervalMs));
	}
}

async function waitForTcp(label: string, host: string, port: number): Promise<void> {
	await waitFor(
		label,
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
		3000,
		40,
	);
}

async function waitForHttp(label: string, url: string, okStatuses?: number[]): Promise<void> {
	await waitFor(
		label,
		async () => {
			try {
				const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
				if (okStatuses) return okStatuses.includes(res.status);
				return res.status !== undefined;
			} catch {
				return false;
			}
		},
		3000,
		40,
	);
}

// ── 1. Keycloak ─────────────────────────────────────────────────────

interface KeycloakResult {
	webClientId: string;
	webClientSecret: string;
	cliClientId: string;
	apiClientId: string;
	apiClientSecret: string;
}

async function initKeycloak(): Promise<KeycloakResult> {
	const keycloakUrl = requireEnv("KEYCLOAK_URL").replace(/\/$/, "");
	const realm = optionalEnv("KEYCLOAK_REALM", "envsync");
	const adminUser = requireEnv("KEYCLOAK_ADMIN_USER");
	const adminPass = requireEnv("KEYCLOAK_ADMIN_PASSWORD");

	console.log(`\n=== Keycloak (${keycloakUrl}) ===`);

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

	async function adminFetch(path: string, opts: RequestInit = {}): Promise<Response> {
		return fetch(`${keycloakUrl}/admin/realms/${realm}${path}`, {
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

	const webClientId = optionalEnv("KEYCLOAK_WEB_CLIENT_ID", "envsync-web");
	const cliClientId = optionalEnv("KEYCLOAK_CLI_CLIENT_ID", "envsync-cli");
	const apiClientId = optionalEnv("KEYCLOAK_API_CLIENT_ID", "envsync-api");

	const web = await getClientSecret(webClientId);
	console.log(`  Web client: ${webClientId} (secret: ${web.secret.slice(0, 8)}...)`);

	const cli = await getClientSecret(cliClientId);
	console.log(`  CLI client: ${cliClientId} (public)`);

	const api = await getClientSecret(apiClientId);
	console.log(`  API client: ${apiClientId} (secret: ${api.secret.slice(0, 8)}...)`);

	return {
		webClientId,
		webClientSecret: web.secret,
		cliClientId,
		apiClientId,
		apiClientSecret: api.secret,
	};
}

// ── 2. SpacetimeDB ──────────────────────────────────────────────────

async function initSpacetimeDB(): Promise<{ rootKey: string }> {
	const stdbUrl = requireEnv("STDB_URL").replace(/\/$/, "");

	console.log(`\n=== SpacetimeDB (${stdbUrl}) ===`);

	// Verify health
	const pingRes = await fetch(`${stdbUrl}/v1/ping`, { signal: AbortSignal.timeout(5000) });
	if (!pingRes.ok) throw new Error(`SpacetimeDB health check failed: ${pingRes.status}`);
	console.log("  SpacetimeDB is healthy.");

	// Generate root key if not set
	let rootKey = optionalEnv("STDB_ROOT_KEY");
	if (!rootKey) {
		rootKey = randomBytes(32).toString("hex");
		console.log("  Generated STDB_ROOT_KEY.");
	} else {
		console.log("  STDB_ROOT_KEY already set.");
	}

	return { rootKey };
}

// ── 3. RustFS (S3 bucket) ───────────────────────────────────────────

async function initRustfs(): Promise<void> {
	const endpoint = requireEnv("S3_ENDPOINT");
	const bucket = optionalEnv("S3_BUCKET", "envsync-bucket");

	console.log(`\n=== RustFS (${endpoint}) ===`);

	const client = new S3Client({
		region: optionalEnv("S3_REGION", "us-east-1"),
		endpoint,
		forcePathStyle: true,
		credentials: {
			accessKeyId: requireEnv("S3_ACCESS_KEY"),
			secretAccessKey: requireEnv("S3_SECRET_KEY"),
		},
	});

	const maxRetries = 5;
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			await client.send(new CreateBucketCommand({ Bucket: bucket, ACL: "public-read" }));
			console.log(`  Bucket '${bucket}' created.`);
			return;
		} catch (e: unknown) {
			const err = e as { name?: string; Code?: string };
			if (err?.name === "BucketAlreadyOwnedByYou" || err?.Code === "BucketAlreadyOwnedByYou") {
				console.log(`  Bucket '${bucket}' already exists.`);
				return;
			}
			const code = (e as { code?: string })?.code;
			if ((code === "ECONNRESET" || code === "ECONNREFUSED") && attempt < maxRetries) {
				console.log(`  Connection failed (attempt ${attempt}/${maxRetries}), retrying...`);
				await new Promise(r => setTimeout(r, 3000));
				continue;
			}
			throw e;
		}
	}
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
	console.log("============================================");
	console.log("  EnvSync Production Init");
	console.log("============================================\n");

	type StepStatus = "completed" | "skipped" | "failed";
	const tracking: { name: string; status: StepStatus }[] = [];
	const credentialSections: { name: string; entries: Record<string, string> }[] = [];

	async function step<T>(
		name: string,
		requiredEnvKeys: string[],
		fn: () => Promise<T>,
		extractCredentials?: (result: T) => Record<string, string>,
	): Promise<T | null> {
		const missing = requiredEnvKeys.filter(k => !process.env[k]);
		if (missing.length > 0) {
			console.log(`\n=== ${name} === SKIPPED (missing: ${missing.join(", ")})`);
			tracking.push({ name, status: "skipped" });
			return null;
		}
		try {
			const result = await fn();
			tracking.push({ name, status: "completed" });
			if (extractCredentials) {
				const entries = extractCredentials(result);
				if (Object.keys(entries).length > 0) {
					credentialSections.push({ name, entries });
				}
			}
			return result;
		} catch (err) {
			console.error(`\n  [${name}] ERROR: ${err instanceof Error ? err.message : err}`);
			tracking.push({ name, status: "failed" });
			return null;
		}
	}

	// ── Conditional wait phase ───────────────────────────────────────

	console.log("Waiting for services...");

	const waits: Promise<void>[] = [];

	const keycloakUrl = optionalEnv("KEYCLOAK_URL")?.replace(/\/$/, "");
	if (keycloakUrl) {
		const realm = optionalEnv("KEYCLOAK_REALM", "envsync");
		waits.push(waitForHttp("Keycloak", `${keycloakUrl}/realms/${realm}/.well-known/openid-configuration`, [200]));
	}

	const stdbUrl = optionalEnv("STDB_URL")?.replace(/\/$/, "");
	if (stdbUrl) {
		waits.push(waitForHttp("SpacetimeDB", `${stdbUrl}/v1/ping`, [200]));
	}

	const s3Endpoint = optionalEnv("S3_ENDPOINT")?.replace(/\/$/, "");
	if (s3Endpoint) {
		try {
			const u = new URL(s3Endpoint);
			const port = u.port ? parseInt(u.port, 10) : u.protocol === "https:" ? 443 : 80;
			waits.push(waitForTcp("RustFS", u.hostname, port));
		} catch {}
	}

	const redisUrl = optionalEnv("REDIS_URL");
	if (redisUrl) {
		try {
			const u = new URL(redisUrl);
			const port = u.port ? parseInt(u.port, 10) : 6379;
			waits.push(waitForTcp("Redis", u.hostname, port));
		} catch {}
	}

	if (waits.length === 0) {
		console.log("  No services configured — nothing to wait for.");
	}
	await Promise.all(waits);

	// ── Service steps ────────────────────────────────────────────────

	await step("Keycloak", ["KEYCLOAK_URL", "KEYCLOAK_ADMIN_USER", "KEYCLOAK_ADMIN_PASSWORD"], initKeycloak, kc => ({
		KEYCLOAK_WEB_CLIENT_ID: kc.webClientId,
		KEYCLOAK_WEB_CLIENT_SECRET: kc.webClientSecret,
		KEYCLOAK_CLI_CLIENT_ID: kc.cliClientId,
		KEYCLOAK_API_CLIENT_ID: kc.apiClientId,
		KEYCLOAK_API_CLIENT_SECRET: kc.apiClientSecret,
	}));

	await step("SpacetimeDB", ["STDB_URL"], initSpacetimeDB, stdb => ({
		STDB_ROOT_KEY: stdb.rootKey,
	}));

	await step("RustFS", ["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY"], initRustfs);

	await step(
		"HyperDX",
		[],
		async () => {
			console.log(`\n=== HyperDX ===`);

			const hdxUrl = `http://hdx:8080`;

			// Wait for HyperDX to be reachable (internal Docker network)
			await waitForHttp("HyperDX", `${hdxUrl}/api/health`, [200, 404, 302]);

			// Wait a bit for full readiness
			await new Promise(r => setTimeout(r, 3000));

			// Register default user
			try {
				const res = await fetch(`${hdxUrl}/api/register/password`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						email: "dev@envsync.local",
						password: "TestDev@1234",
						confirmPassword: "TestDev@1234",
					}),
					signal: AbortSignal.timeout(10000),
				});
				if (res.ok) {
					console.log("  Default user registered (dev@envsync.local / TestDev@1234).");
				} else {
					const body = await res.text();
					if (body.includes("already") || res.status === 409) {
						console.log("  Default user already exists.");
					} else {
						console.log(`  User registration returned ${res.status}: ${body}`);
					}
				}
			} catch (err) {
				console.log(`  HyperDX user registration skipped: ${err instanceof Error ? err.message : err}`);
			}
		},
	);

	// ── Summary ──────────────────────────────────────────────────────

	const completed = tracking.filter(t => t.status === "completed");
	const skipped = tracking.filter(t => t.status === "skipped");
	const failed = tracking.filter(t => t.status === "failed");

	console.log("\n============================================");
	console.log("  Init complete! Generated credentials:");
	console.log("============================================\n");

	if (credentialSections.length === 0) {
		console.log("(no credentials to display)\n");
	} else {
		for (const section of credentialSections) {
			console.log(`# --- ${section.name} ---`);
			for (const [key, value] of Object.entries(section.entries)) {
				console.log(`${key}=${value}`);
			}
			console.log("");
		}
	}

	console.log("--------------------------------------------");
	console.log(
		`  Completed: ${completed.length}  |  Skipped: ${skipped.length}  |  Failed: ${failed.length}`,
	);
	if (skipped.length > 0) {
		console.log(`  Skipped services: ${skipped.map(s => s.name).join(", ")}`);
	}
	if (failed.length > 0) {
		console.log(`  Failed services:  ${failed.map(s => s.name).join(", ")}`);
	}
	console.log("--------------------------------------------");

	if (credentialSections.length > 0) {
		console.log("\nCopy the above into your .env file, then start the API:");
		console.log("  docker compose -f docker-compose.prod.yaml up -d envsync_api");
	}

	if (failed.length > 0) {
		process.exit(1);
	}
}

await main().catch(err => {
	console.error("\nInit failed:", err);
	process.exit(1);
});

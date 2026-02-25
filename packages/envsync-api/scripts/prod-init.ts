#!/usr/bin/env bun
/**
 * Production one-shot init script for EnvSync.
 *
 * Bootstraps all infrastructure services on first deployment:
 *   1. Vault: init, unseal, KV v2 mount, AppRole setup
 *   2. Zitadel: read PAT, create project + OIDC apps (Web, CLI, API)
 *   3. OpenFGA: create store + write authorization model
 *   4. Database: run Kysely migrations
 *   5. RustFS: create S3 bucket
 *   6. miniKMS: verify gRPC reachability
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

import fs from "node:fs";
import path from "node:path";
import net from "node:net";

import { OpenFgaClient } from "@openfga/sdk";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { FileMigrationProvider, Kysely, Migrator, PostgresDialect } from "kysely";
import { Pool } from "pg";

// Import the authorization model definition (no side effects, no config dependency)
import { authorizationModelDef } from "../src/libs/openfga/model";

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

// ── 1. Vault ────────────────────────────────────────────────────────

interface VaultResult {
	rootToken: string;
	unsealKey: string;
	roleId: string;
	secretId: string;
}

async function initVault(): Promise<VaultResult> {
	const vaultAddr = requireEnv("VAULT_ADDR").replace(/\/$/, "");
	const mountPath = optionalEnv("VAULT_MOUNT_PATH", "envsync");
	const policyName = "envsync-api";
	const roleName = "envsync-api";

	console.log(`\n=== Vault (${vaultAddr}) ===`);

	let rootToken = optionalEnv("VAULT_TOKEN");
	let unsealKey = optionalEnv("VAULT_UNSEAL_KEY");

	async function vaultFetch(urlPath: string, opts: RequestInit = {}): Promise<Response> {
		return fetch(`${vaultAddr}${urlPath}`, {
			...opts,
			headers: {
				"Content-Type": "application/json",
				...(rootToken ? { "X-Vault-Token": rootToken } : {}),
				...(opts.headers || {}),
			},
			signal: AbortSignal.timeout(10000),
		});
	}

	// Check init status
	const initRes = await vaultFetch("/v1/sys/init");
	const { initialized } = (await initRes.json()) as { initialized: boolean };

	if (!initialized) {
		console.log("  Initializing (1 key share, 1 threshold)...");
		const resp = await vaultFetch("/v1/sys/init", {
			method: "PUT",
			body: JSON.stringify({ secret_shares: 1, secret_threshold: 1 }),
		});
		if (!resp.ok) throw new Error(`Vault init failed (${resp.status}): ${await resp.text()}`);
		const data = (await resp.json()) as { keys: string[]; keys_base64: string[]; root_token: string };
		rootToken = data.root_token;
		unsealKey = data.keys_base64[0] || data.keys[0] || "";
		console.log("  Vault initialized.");
	} else {
		console.log("  Already initialized.");
	}

	// Unseal if sealed
	const healthRes = await vaultFetch("/v1/sys/health");
	if (healthRes.status === 503) {
		if (!unsealKey) throw new Error("Vault is sealed but no unseal key is available.");
		console.log("  Unsealing...");
		const unsealRes = await vaultFetch("/v1/sys/unseal", {
			method: "PUT",
			body: JSON.stringify({ key: unsealKey }),
		});
		if (!unsealRes.ok) throw new Error(`Vault unseal failed: ${await unsealRes.text()}`);
		console.log("  Unsealed.");
	} else {
		console.log("  Already unsealed.");
	}

	if (!rootToken) throw new Error("No root token available. Set VAULT_TOKEN env var.");

	// Enable KV v2
	console.log(`  Enabling KV v2 at "${mountPath}/"...`);
	const mountRes = await vaultFetch(`/v1/sys/mounts/${mountPath}`, {
		method: "POST",
		body: JSON.stringify({ type: "kv", options: { version: "2" } }),
	});
	if (mountRes.ok) {
		console.log(`  KV v2 enabled.`);
	} else if (mountRes.status === 400 && (await mountRes.text()).includes("existing mount")) {
		console.log(`  KV v2 already mounted.`);
	} else {
		throw new Error(`Failed to enable KV v2 (${mountRes.status})`);
	}

	// Enable AppRole
	console.log("  Enabling AppRole...");
	const authRes = await vaultFetch("/v1/sys/auth/approle", {
		method: "POST",
		body: JSON.stringify({ type: "approle" }),
	});
	if (authRes.ok) {
		console.log("  AppRole enabled.");
	} else if (authRes.status === 400 && (await authRes.text()).includes("existing mount")) {
		console.log("  AppRole already enabled.");
	} else {
		throw new Error(`Failed to enable AppRole (${authRes.status})`);
	}

	// Create policy
	console.log(`  Creating policy '${policyName}'...`);
	const policy = `
path "${mountPath}/data/*" { capabilities = ["create","read","update","delete","list"] }
path "${mountPath}/metadata/*" { capabilities = ["read","delete","list"] }
path "${mountPath}/delete/*" { capabilities = ["update"] }
path "${mountPath}/undelete/*" { capabilities = ["update"] }
path "${mountPath}/destroy/*" { capabilities = ["update"] }
path "auth/token/renew-self" { capabilities = ["update"] }
path "sys/health" { capabilities = ["read"] }
`.trim();
	const policyRes = await vaultFetch(`/v1/sys/policy/${policyName}`, {
		method: "PUT",
		body: JSON.stringify({ policy }),
	});
	if (!policyRes.ok) throw new Error(`Failed to create policy: ${await policyRes.text()}`);
	console.log(`  Policy created.`);

	// Create role
	console.log(`  Creating AppRole role '${roleName}'...`);
	const roleRes = await vaultFetch(`/v1/auth/approle/role/${roleName}`, {
		method: "POST",
		body: JSON.stringify({
			token_policies: [policyName],
			token_ttl: "1h",
			token_max_ttl: "4h",
			secret_id_ttl: "0",
			secret_id_num_uses: 0,
		}),
	});
	if (!roleRes.ok) throw new Error(`Failed to create role: ${await roleRes.text()}`);

	// Get role_id
	const roleIdRes = await vaultFetch(`/v1/auth/approle/role/${roleName}/role-id`);
	if (!roleIdRes.ok) throw new Error(`Failed to get role_id: ${await roleIdRes.text()}`);
	const { data: roleIdData } = (await roleIdRes.json()) as { data: { role_id: string } };

	// Generate secret_id
	const secretIdRes = await vaultFetch(`/v1/auth/approle/role/${roleName}/secret-id`, {
		method: "POST",
		body: JSON.stringify({}),
	});
	if (!secretIdRes.ok) throw new Error(`Failed to generate secret_id: ${await secretIdRes.text()}`);
	const { data: secretIdData } = (await secretIdRes.json()) as { data: { secret_id: string } };

	console.log(`  Role ID: ${roleIdData.role_id}`);
	console.log(`  Secret ID: ${secretIdData.secret_id.slice(0, 8)}...`);

	return {
		rootToken,
		unsealKey,
		roleId: roleIdData.role_id,
		secretId: secretIdData.secret_id,
	};
}

// ── 2. Zitadel ──────────────────────────────────────────────────────

interface ZitadelResult {
	pat: string;
	webClientId: string;
	webClientSecret: string;
	cliClientId: string;
	cliClientSecret: string;
	apiClientId: string;
	apiClientSecret: string;
}

async function initZitadel(): Promise<ZitadelResult | null> {
	const zitadelUrl = requireEnv("ZITADEL_URL").replace(/\/$/, "");

	console.log(`\n=== Zitadel (${zitadelUrl}) ===`);

	// Read PAT from file or env
	let pat = optionalEnv("ZITADEL_PAT");
	const patFile = optionalEnv("ZITADEL_PAT_FILE");
	if (!pat && patFile) {
		try {
			pat = fs.readFileSync(patFile, "utf8").trim();
			console.log(`  PAT read from ${patFile}`);
		} catch {
			console.log(`  Could not read PAT file: ${patFile}`);
		}
	}
	if (!pat) {
		console.log("  No PAT available (ZITADEL_PAT or ZITADEL_PAT_FILE). Skipping OIDC setup.");
		return null;
	}

	const headers = {
		Authorization: `Bearer ${pat}`,
		"Content-Type": "application/json",
	};

	// Get or create project
	const projectName = "EnvSync";
	let projectId: string | undefined;

	const listRes = await fetch(`${zitadelUrl}/management/v1/projects/_search`, {
		method: "POST",
		headers,
		body: JSON.stringify({}),
	});
	if (listRes.ok) {
		const data = (await listRes.json()) as { result?: Array<{ id: string; name: string }> };
		projectId = data.result?.find(p => p.name === projectName)?.id;
	}
	if (!projectId) {
		const createRes = await fetch(`${zitadelUrl}/management/v1/projects`, {
			method: "POST",
			headers,
			body: JSON.stringify({ name: projectName }),
		});
		if (!createRes.ok) throw new Error(`Zitadel create project failed: ${await createRes.text()}`);
		projectId = ((await createRes.json()) as { id: string }).id;
	}
	console.log(`  Project '${projectName}' ready (${projectId}).`);

	// Helper to create OIDC app
	async function createApp(
		name: string,
		redirectUris: string[],
		appType: string,
		authMethod: string,
		postLogoutUris?: string[],
	): Promise<{ clientId: string; clientSecret: string }> {
		const res = await fetch(
			`${zitadelUrl}/zitadel.application.v2.ApplicationService/CreateApplication`,
			{
				method: "POST",
				headers: {
					...headers,
					"Connect-Protocol-Version": "1",
					Accept: "application/json",
				},
				body: JSON.stringify({
					projectId,
					name,
					applicationType: "APPLICATION_TYPE_OIDC",
					oidcConfiguration: {
						version: "OIDC_VERSION_1_0",
						redirectUris,
						responseTypes: ["OIDC_RESPONSE_TYPE_CODE"],
						grantTypes: ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE"],
						appType,
						authMethodType: authMethod,
						postLogoutRedirectUris: postLogoutUris ?? redirectUris,
					},
				}),
			},
		);
		if (!res.ok) throw new Error(`Zitadel CreateApplication '${name}' failed: ${await res.text()}`);
		const data = (await res.json()) as {
			oidcConfiguration?: { clientId?: string; clientSecret?: string };
			clientId?: string;
			clientSecret?: string;
		};
		const oidc = data.oidcConfiguration ?? data;
		const clientId = oidc.clientId ?? data.clientId;
		if (!clientId) throw new Error(`Zitadel CreateApplication '${name}': no clientId in response`);
		return { clientId, clientSecret: oidc.clientSecret ?? data.clientSecret ?? "" };
	}

	const webRedirect = requireEnv("ZITADEL_WEB_REDIRECT_URI");
	const webLogout = optionalEnv("ZITADEL_WEB_CALLBACK_URL", webRedirect);
	const apiRedirect = requireEnv("ZITADEL_API_REDIRECT_URI");

	const web = await createApp("EnvSync Web", [webRedirect], "OIDC_APP_TYPE_WEB", "OIDC_AUTH_METHOD_TYPE_POST", [webLogout]);
	console.log(`  Web app created: ${web.clientId}`);

	const cli = await createApp("EnvSync CLI", ["http://localhost:8081/callback"], "OIDC_APP_TYPE_NATIVE", "OIDC_AUTH_METHOD_TYPE_NONE");
	console.log(`  CLI app created: ${cli.clientId}`);

	const api = await createApp("EnvSync API", [apiRedirect], "OIDC_APP_TYPE_WEB", "OIDC_AUTH_METHOD_TYPE_POST");
	console.log(`  API app created: ${api.clientId}`);

	return {
		pat,
		webClientId: web.clientId,
		webClientSecret: web.clientSecret,
		cliClientId: cli.clientId,
		cliClientSecret: cli.clientSecret,
		apiClientId: api.clientId,
		apiClientSecret: api.clientSecret,
	};
}

// ── 3. OpenFGA ──────────────────────────────────────────────────────

interface OpenFGAResult {
	storeId: string;
	modelId: string;
}

async function initOpenFGA(): Promise<OpenFGAResult> {
	const apiUrl = requireEnv("OPENFGA_API_URL").replace(/\/$/, "");

	console.log(`\n=== OpenFGA (${apiUrl}) ===`);

	// Check if already configured
	const existingStoreId = optionalEnv("OPENFGA_STORE_ID");
	const existingModelId = optionalEnv("OPENFGA_MODEL_ID");
	if (existingStoreId && existingModelId) {
		console.log(`  Already configured (store=${existingStoreId}, model=${existingModelId}).`);
		return { storeId: existingStoreId, modelId: existingModelId };
	}

	const bootstrapClient = new OpenFgaClient({ apiUrl });

	// Create store
	const { id: storeId } = await bootstrapClient.createStore({ name: "envsync" });
	if (!storeId) throw new Error("OpenFGA: failed to create store");
	console.log(`  Store created: ${storeId}`);

	// Write authorization model
	const modelClient = new OpenFgaClient({ apiUrl, storeId });
	const { authorization_model_id: modelId } = await modelClient.writeAuthorizationModel(authorizationModelDef);
	if (!modelId) throw new Error("OpenFGA: failed to write authorization model");
	console.log(`  Model written: ${modelId}`);

	return { storeId, modelId };
}

// ── 4. Database migrations ──────────────────────────────────────────

async function initDatabase(): Promise<void> {
	console.log("\n=== Database ===");

	const pool = new Pool({
		host: requireEnv("DATABASE_HOST"),
		port: Number(optionalEnv("DATABASE_PORT", "5432")),
		user: requireEnv("DATABASE_USER"),
		password: requireEnv("DATABASE_PASSWORD"),
		database: requireEnv("DATABASE_NAME"),
		max: 3,
		ssl: optionalEnv("DATABASE_SSL") === "true" ? { rejectUnauthorized: false } : false,
	});

	const db = new Kysely<any>({
		dialect: new PostgresDialect({ pool }),
	});

	const migrationFolder = path.resolve(import.meta.dir, "../src/libs/db/migrations");
	console.log(`  Migrations folder: ${migrationFolder}`);

	const migrator = new Migrator({
		db,
		provider: new FileMigrationProvider({
			fs: await import("node:fs/promises"),
			path,
			migrationFolder,
		}),
	});

	const { results, error } = await migrator.migrateToLatest();

	if (error) {
		throw new Error(`Migration error: ${error}`);
	}
	if (results?.length) {
		for (const { migrationName, status } of results) {
			console.log(`  ${migrationName}: ${status}`);
		}
	} else {
		console.log("  All migrations up-to-date.");
	}

	await db.destroy();
}

// ── 5. RustFS (S3 bucket) ───────────────────────────────────────────

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

	// ── Step helper ──────────────────────────────────────────────────

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

	const dbHost = optionalEnv("DATABASE_HOST");
	if (dbHost) {
		const dbPort = Number(optionalEnv("DATABASE_PORT", "5432"));
		waits.push(waitForTcp("Postgres", dbHost, dbPort));
	}

	const minikmsRaw = optionalEnv("MINIKMS_GRPC_ADDR");
	if (minikmsRaw) {
		const [host, portStr] = minikmsRaw.split(":");
		waits.push(waitForTcp("miniKMS", host, Number(portStr)));
	}

	const vaultAddr = optionalEnv("VAULT_ADDR")?.replace(/\/$/, "");
	if (vaultAddr) {
		waits.push(waitForHttp("Vault", `${vaultAddr}/v1/sys/health`, [200, 429, 501, 503]));
	}

	const openfgaUrl = optionalEnv("OPENFGA_API_URL")?.replace(/\/$/, "");
	if (openfgaUrl) {
		waits.push(waitForHttp("OpenFGA", `${openfgaUrl}/healthz`, [200]));
	}

	const zitadelUrl = optionalEnv("ZITADEL_URL")?.replace(/\/$/, "");
	if (zitadelUrl) {
		waits.push(waitForHttp("Zitadel", `${zitadelUrl}/.well-known/openid-configuration`, [200]));
	}

	if (waits.length === 0) {
		console.log("  No services configured — nothing to wait for.");
	}
	await Promise.all(waits);

	// ── Service steps ────────────────────────────────────────────────

	await step("Vault", ["VAULT_ADDR"], initVault, vault => ({
		VAULT_TOKEN: vault.rootToken,
		VAULT_UNSEAL_KEY: vault.unsealKey,
		VAULT_ROLE_ID: vault.roleId,
		VAULT_SECRET_ID: vault.secretId,
	}));

	await step("Zitadel", ["ZITADEL_URL"], initZitadel, zitadel =>
		zitadel
			? {
					ZITADEL_PAT: zitadel.pat ?? "",
					ZITADEL_WEB_CLIENT_ID: zitadel.webClientId ?? "",
					ZITADEL_WEB_CLIENT_SECRET: zitadel.webClientSecret ?? "",
					ZITADEL_CLI_CLIENT_ID: zitadel.cliClientId ?? "",
					ZITADEL_CLI_CLIENT_SECRET: zitadel.cliClientSecret ?? "",
					ZITADEL_API_CLIENT_ID: zitadel.apiClientId ?? "",
					ZITADEL_API_CLIENT_SECRET: zitadel.apiClientSecret ?? "",
				} as Record<string, string>
			: {},
	);

	await step("OpenFGA", ["OPENFGA_API_URL"], initOpenFGA, openfga => ({
		OPENFGA_STORE_ID: openfga.storeId,
		OPENFGA_MODEL_ID: openfga.modelId,
	}));

	await step(
		"Database",
		["DATABASE_HOST", "DATABASE_USER", "DATABASE_PASSWORD", "DATABASE_NAME"],
		initDatabase,
	);

	await step("RustFS", ["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY"], initRustfs);

	await step(
		"HyperDX",
		[],
		async () => {
			const hdxPort = optionalEnv("HDX_PORT", "8800");
			const hdxUrl = `http://hdx:8080`;

			console.log(`\n=== HyperDX ===`);

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

	await step(
		"miniKMS",
		["MINIKMS_GRPC_ADDR"],
		async () => {
			const addr = requireEnv("MINIKMS_GRPC_ADDR");
			console.log(`\n=== miniKMS ===`);
			console.log(`  gRPC address: ${addr}`);
			console.log("  miniKMS is reachable (TCP check passed during service wait).");
		},
		() => ({
			MINIKMS_GRPC_ADDR: optionalEnv("MINIKMS_GRPC_ADDR", "minikms:50051"),
			MINIKMS_TLS_ENABLED: optionalEnv("MINIKMS_TLS_ENABLED", "false"),
			MINIKMS_ROOT_KEY: optionalEnv("MINIKMS_ROOT_KEY", "(set in .env)"),
		}),
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

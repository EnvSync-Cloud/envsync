#!/usr/bin/env bun
/**
 * EnvSync API CLI – init RustFS (S3) bucket and Zitadel OIDC apps (when ZITADEL_PAT is set).
 * Run from monorepo root: bun run scripts/cli.ts init (from packages/envsync-api)
 * Or: cd packages/envsync-api && bun run scripts/cli.ts init
 *
 * Zitadel: With ZITADEL_PAT set, creates a project "EnvSync" and OIDC apps (Web, CLI, API) via
 * the Application Service v2 API and writes client IDs/secrets to the root .env.
 */


import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";

import { config } from "../src/utils/env";
import { findMonorepoRoot, updateRootEnv } from "../src/utils/load-root-env";
import { DB } from "../src/libs/db";
import { VaultClient } from "../src/libs/vault";
import { envPath } from "../src/libs/vault/paths";
import { SecretKeyGenerator } from "sk-keygen";

const ZITADEL_PROJECT_NAME = "EnvSync";

/**
 * Resolve ZITADEL PAT from env or from file (bootstrap admin.pat when using bind-mount).
 * Use ZITADEL_PAT_FILE=e.g. ./zitadel-data/admin.pat to read the PAT created by
 * ZITADEL_FIRSTINSTANCE_PATPATH on first Zitadel start.
 */
function resolveZitadelPat(): { pat: string; fromFile: boolean } {
	const fromEnv = config.ZITADEL_PAT?.trim();
	if (fromEnv) return { pat: fromEnv, fromFile: false };
	const filePath = process.env.ZITADEL_PAT_FILE;
	if (!filePath?.trim()) return { pat: "", fromFile: false };
	const resolved = path.isAbsolute(filePath)
		? filePath
		: path.resolve(findMonorepoRoot(), filePath.trim());
	try {
		if (fs.existsSync(resolved)) {
			const pat = fs.readFileSync(resolved, "utf8").trim();
			if (pat) return { pat, fromFile: true };
		}
	} catch {
		// ignore
	}
	return { pat: "", fromFile: false };
}

function zitadelBase(): string {
	return config.ZITADEL_URL.replace(/\/$/, "");
}

async function getOrCreateZitadelProject(pat: string): Promise<string> {
	const base = zitadelBase();
	const listRes = await fetch(`${base}/management/v1/projects/_search`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${pat}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({}),
	});
	if (listRes.ok) {
		const data = (await listRes.json()) as { result?: Array<{ id: string; name: string }> };
		const projects = data.result ?? [];
		const existing = projects.find((p: { name: string }) => p.name === ZITADEL_PROJECT_NAME);
		if (existing) {
			return existing.id;
		}
	}
	const createRes = await fetch(`${base}/management/v1/projects`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${pat}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ name: ZITADEL_PROJECT_NAME }),
	});
	if (!createRes.ok) {
		const text = await createRes.text();
		throw new Error(`Zitadel create project failed: ${createRes.status} ${text}`);
	}
	const data = (await createRes.json()) as { id: string };
	return data.id;
}

type OIDCAppType = "OIDC_APP_TYPE_WEB" | "OIDC_APP_TYPE_NATIVE";
type OIDCAuthMethod = "OIDC_AUTH_METHOD_TYPE_POST" | "OIDC_AUTH_METHOD_TYPE_NONE";

async function createZitadelOIDCApp(
	pat: string,
	projectId: string,
	appName: string,
	opts: {
		redirectUris: string[];
		postLogoutRedirectUris?: string[];
		appType: OIDCAppType;
		authMethodType: OIDCAuthMethod;
	},
): Promise<{ clientId: string; clientSecret?: string }> {
	const base = zitadelBase();
	const url = `${base}/zitadel.application.v2.ApplicationService/CreateApplication`;
	const payload = {
		projectId,
		name: appName,
		applicationType: "APPLICATION_TYPE_OIDC",
		oidcConfiguration: {
			version: "OIDC_VERSION_1_0",
			redirectUris: opts.redirectUris,
			responseTypes: ["OIDC_RESPONSE_TYPE_CODE"],
			grantTypes: ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE"],
			appType: opts.appType,
			authMethodType: opts.authMethodType,
			postLogoutRedirectUris: opts.postLogoutRedirectUris ?? opts.redirectUris,
		},
	};
	const res = await fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${pat}`,
			"Content-Type": "application/json",
			"Connect-Protocol-Version": "1",
			Accept: "application/json",
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Zitadel CreateApplication ${appName} failed: ${res.status} ${text}`);
	}
	const data = (await res.json()) as {
		oidcConfiguration?: { clientId?: string; clientSecret?: string };
		apiConfiguration?: { clientId?: string; clientSecret?: string };
		clientId?: string;
		clientSecret?: string;
	};
	const oidc = data.oidcConfiguration ?? data.apiConfiguration ?? data;
	const clientId = oidc.clientId ?? data.clientId;
	if (!clientId) {
		throw new Error(`Zitadel CreateApplication ${appName}: no clientId in response`);
	}
	return { clientId, clientSecret: oidc.clientSecret ?? data.clientSecret };
}

async function initZitadelApps(): Promise<Record<string, string>> {
	const { pat, fromFile } = resolveZitadelPat();
	if (!pat) {
		console.log(
			"Zitadel: ZITADEL_PAT (or ZITADEL_PAT_FILE for bootstrap admin.pat) not set, skipping OIDC app creation.",
		);
		return {};
	}
	if (fromFile) console.log("Zitadel: using PAT from ZITADEL_PAT_FILE.");
	const updates: Record<string, string> = {};
	if (fromFile) updates.ZITADEL_PAT = pat;
	const projectId = await getOrCreateZitadelProject(pat);
	console.log("Zitadel: project", ZITADEL_PROJECT_NAME, "ready.");

	const webRedirect = config.ZITADEL_WEB_REDIRECT_URI;
	const webLogout = config.ZITADEL_WEB_CALLBACK_URL || webRedirect;
	const apiRedirect = config.ZITADEL_API_REDIRECT_URI;

	// Web app (confidential)
	const web = await createZitadelOIDCApp(pat, projectId, "EnvSync Web", {
		redirectUris: [webRedirect],
		postLogoutRedirectUris: [webLogout],
		appType: "OIDC_APP_TYPE_WEB",
		authMethodType: "OIDC_AUTH_METHOD_TYPE_POST",
	});
	updates.ZITADEL_WEB_CLIENT_ID = web.clientId;
	if (web.clientSecret) updates.ZITADEL_WEB_CLIENT_SECRET = web.clientSecret;
	console.log("Zitadel: Web app created.", web.clientId);

	// CLI app (native / public)
	const cli = await createZitadelOIDCApp(pat, projectId, "EnvSync CLI", {
		redirectUris: ["http://localhost:8081/callback"],
		appType: "OIDC_APP_TYPE_NATIVE",
		authMethodType: "OIDC_AUTH_METHOD_TYPE_NONE",
	});
	updates.ZITADEL_CLI_CLIENT_ID = cli.clientId;
	if (cli.clientSecret) updates.ZITADEL_CLI_CLIENT_SECRET = cli.clientSecret;
	console.log("Zitadel: CLI app created.", cli.clientId);

	// API app (confidential)
	const api = await createZitadelOIDCApp(pat, projectId, "EnvSync API", {
		redirectUris: [apiRedirect],
		postLogoutRedirectUris: [apiRedirect],
		appType: "OIDC_APP_TYPE_WEB",
		authMethodType: "OIDC_AUTH_METHOD_TYPE_POST",
	});
	updates.ZITADEL_API_CLIENT_ID = api.clientId;
	if (api.clientSecret) updates.ZITADEL_API_CLIENT_SECRET = api.clientSecret;
	console.log("Zitadel: API app created.", api.clientId);

	return updates;
}

const RUSTFS_RETRIES = 5;
const RUSTFS_RETRY_DELAY_MS = 3000;

function isRetryableConnectionError(e: unknown): boolean {
	const err = e as { code?: string; name?: string };
	return (
		err?.code === "ECONNRESET" ||
		err?.code === "ECONNREFUSED" ||
		err?.name === "TimeoutError" ||
		err?.name === "FetchError"
	);
}

async function initRustfsBucket() {
	const bucket = config.S3_BUCKET;
	const client = new S3Client({
		region: config.S3_REGION,
		endpoint: config.S3_ENDPOINT,
		forcePathStyle: true,
		credentials: {
			accessKeyId: config.S3_ACCESS_KEY,
			secretAccessKey: config.S3_SECRET_KEY,
		},
	});
	let lastError: unknown;
	for (let attempt = 1; attempt <= RUSTFS_RETRIES; attempt++) {
		try {
			await client.send(new CreateBucketCommand({ Bucket: bucket }));
			console.log("Rustfs: bucket", bucket, "created.");
			return;
		} catch (e: unknown) {
			const err = e as { name?: string; Code?: string };
			if (err?.name === "BucketAlreadyOwnedByYou" || err?.Code === "BucketAlreadyOwnedByYou") {
				console.log("Rustfs: bucket", bucket, "already exists.");
				return;
			}
			lastError = e;
			if (isRetryableConnectionError(e) && attempt < RUSTFS_RETRIES) {
				console.warn(
					`Rustfs: connection failed (attempt ${attempt}/${RUSTFS_RETRIES}), retrying in ${RUSTFS_RETRY_DELAY_MS / 1000}s...`,
				);
				await new Promise(r => setTimeout(r, RUSTFS_RETRY_DELAY_MS));
				continue;
			}
			throw e;
		}
	}
	throw lastError;
}

async function init() {
	console.log("EnvSync API init: RustFS bucket + Zitadel OIDC apps\n");

	await initRustfsBucket();

	const envUpdates = await initZitadelApps();
	if (Object.keys(envUpdates).length > 0) {
		updateRootEnv(envUpdates);
		console.log("Zitadel: wrote client IDs/secrets to root .env");
	} else if (!resolveZitadelPat().pat) {
		console.log(
			"\nZitadel: Set ZITADEL_PAT in .env (or ZITADEL_PAT_FILE to bootstrap admin.pat) and re-run init to create OIDC apps.",
		);
	}

	console.log("\nInit done.");
}

/**
 * Write OpenFGA relationship tuples for a user based on their org role flags.
 * Uses the REST API directly to avoid pulling in the full FGAClient init chain.
 */
async function assignFGARoles(
	userId: string,
	orgId: string,
	role: {
		is_master: boolean;
		is_admin: boolean;
		can_view: boolean;
		can_edit: boolean;
		have_api_access: boolean;
		have_billing_options: boolean;
		have_webhook_access: boolean;
	},
): Promise<void> {
	const openfgaUrl = config.OPENFGA_API_URL?.replace(/\/$/, "");
	const storeId = config.OPENFGA_STORE_ID;
	const modelId = config.OPENFGA_MODEL_ID;

	if (!openfgaUrl || !storeId) {
		console.log(
			"  FGA: OPENFGA_API_URL or OPENFGA_STORE_ID not set. Run monorepo `bun run cli init` first to bootstrap OpenFGA.",
		);
		return;
	}

	const user = `user:${userId}`;
	const org = `org:${orgId}`;
	const tuples: { user: string; relation: string; object: string }[] = [];

	tuples.push({ user, relation: "member", object: org });
	if (role.is_master) tuples.push({ user, relation: "master", object: org });
	if (role.is_admin) tuples.push({ user, relation: "admin", object: org });
	if (role.can_view) tuples.push({ user, relation: "can_view", object: org });
	if (role.can_edit) tuples.push({ user, relation: "can_edit", object: org });
	if (role.have_api_access) tuples.push({ user, relation: "have_api_access", object: org });
	if (role.have_billing_options) tuples.push({ user, relation: "have_billing_options", object: org });
	if (role.have_webhook_access) tuples.push({ user, relation: "have_webhook_access", object: org });

	console.log(`  FGA: Writing ${tuples.length} tuples for user ${userId} in org ${orgId}...`);

	// Write tuples one by one so we can skip "already exists" errors
	let written = 0;
	let skipped = 0;
	for (const tuple of tuples) {
		const res = await fetch(`${openfgaUrl}/stores/${storeId}/write`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				writes: { tuple_keys: [tuple] },
				...(modelId ? { authorization_model_id: modelId } : {}),
			}),
			signal: AbortSignal.timeout(10000),
		});
		if (res.ok) {
			written++;
		} else {
			const body = await res.text();
			if (body.includes("already exists")) {
				skipped++;
			} else {
				console.warn(`  FGA: Failed to write tuple (${tuple.relation}): ${res.status} ${body}`);
			}
		}
	}
	console.log(`  FGA: ${written} tuples written, ${skipped} already existed.`);
}

/**
 * Write arbitrary FGA tuples, skipping "already exists" errors.
 * Reuses the same OpenFGA REST pattern as assignFGARoles.
 */
async function writeFGATuples(
	tuples: { user: string; relation: string; object: string }[],
): Promise<void> {
	const openfgaUrl = config.OPENFGA_API_URL?.replace(/\/$/, "");
	const storeId = config.OPENFGA_STORE_ID;
	const modelId = config.OPENFGA_MODEL_ID;

	if (!openfgaUrl || !storeId) {
		console.log("  Seed FGA: OPENFGA_API_URL or OPENFGA_STORE_ID not set, skipping tuples.");
		return;
	}

	let written = 0;
	let skipped = 0;
	for (const tuple of tuples) {
		const res = await fetch(`${openfgaUrl}/stores/${storeId}/write`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				writes: { tuple_keys: [tuple] },
				...(modelId ? { authorization_model_id: modelId } : {}),
			}),
			signal: AbortSignal.timeout(10000),
		});
		if (res.ok) {
			written++;
		} else {
			const body = await res.text();
			if (body.includes("already exists")) {
				skipped++;
			} else {
				console.warn(`  Seed FGA: Failed to write tuple (${tuple.relation}): ${res.status} ${body}`);
			}
		}
	}
	console.log(`  Seed FGA: ${written} tuples written, ${skipped} already existed.`);
}

async function seedData(db: Awaited<ReturnType<typeof DB.getInstance>>, orgId: string, userId: string): Promise<void> {
	console.log("\nSeed: Populating sample data...");

	// -- a) Create 2 apps (or load existing) --
	const apps = [
		{ name: "Acme Backend", description: "Core backend API service" },
		{ name: "Acme Frontend", description: "Next.js web application" },
	];

	const envTypeDefs = [
		{ name: "development", color: "#22c55e", is_default: true, is_protected: false },
		{ name: "staging", color: "#f59e0b", is_default: false, is_protected: false },
		{ name: "production", color: "#ef4444", is_default: false, is_protected: true },
	];

	const existingApp = await db
		.selectFrom("app")
		.selectAll()
		.where("org_id", "=", orgId)
		.where("name", "=", "Acme Backend")
		.executeTakeFirst();

	const dbAlreadySeeded = !!existingApp;

	const appIds: Record<string, string> = {};
	// envTypeIds[appName][envTypeName] = id
	const envTypeIds: Record<string, Record<string, string>> = {};

	if (dbAlreadySeeded) {
		console.log("Seed: Sample apps already exist in DB, skipping DB inserts.");
		// Load existing app and env type IDs for Vault writes
		for (const app of apps) {
			const row = await db
				.selectFrom("app")
				.select("id")
				.where("org_id", "=", orgId)
				.where("name", "=", app.name)
				.executeTakeFirstOrThrow();
			appIds[app.name] = row.id;
		}
		for (const [appName, appId] of Object.entries(appIds)) {
			envTypeIds[appName] = {};
			for (const et of envTypeDefs) {
				const row = await db
					.selectFrom("env_type")
					.select("id")
					.where("app_id", "=", appId)
					.where("name", "=", et.name)
					.executeTakeFirstOrThrow();
				envTypeIds[appName][et.name] = row.id;
			}
		}
	} else {
		for (const app of apps) {
			const appId = randomUUID();
			await db
				.insertInto("app")
				.values({
					id: appId,
					name: app.name,
					org_id: orgId,
					description: app.description,
					enable_secrets: false,
					is_managed_secret: false,
					metadata: {},
					created_at: new Date(),
					updated_at: new Date(),
				})
				.execute();
			appIds[app.name] = appId;
			console.log(`Seed: Created app "${app.name}" (${appId})`);
		}

		// -- b) Create 3 env types per app --
		for (const [appName, appId] of Object.entries(appIds)) {
			envTypeIds[appName] = {};
			for (const et of envTypeDefs) {
				const etId = randomUUID();
				await db
					.insertInto("env_type")
					.values({
						id: etId,
						org_id: orgId,
						app_id: appId,
						name: et.name,
						color: et.color,
						is_default: et.is_default,
						is_protected: et.is_protected,
						created_at: new Date(),
						updated_at: new Date(),
					})
					.execute();
				envTypeIds[appName][et.name] = etId;
			}
			console.log(`Seed: Created env types for "${appName}"`);
		}
	}

	// -- c) Write sample env vars to Vault (always attempted) --
	const envVars: Record<string, Record<string, Record<string, string>>> = {
		"Acme Backend": {
			development: {
				DATABASE_URL: "postgresql://dev:dev@localhost:5432/acme_dev",
				REDIS_URL: "redis://localhost:6379/0",
				API_PORT: "3000",
				LOG_LEVEL: "debug",
				JWT_SECRET: "dev-jwt-secret-change-me",
			},
			staging: {
				DATABASE_URL: "postgresql://staging:staging@db-staging:5432/acme_staging",
				REDIS_URL: "redis://redis-staging:6379/0",
				API_PORT: "3000",
				LOG_LEVEL: "info",
				JWT_SECRET: "staging-jwt-secret-change-me",
			},
			production: {
				DATABASE_URL: "postgresql://prod:CHANGE_ME@db-prod:5432/acme_prod",
				REDIS_URL: "redis://redis-prod:6379/0",
				API_PORT: "3000",
				LOG_LEVEL: "warn",
				JWT_SECRET: "CHANGE_ME_IN_PRODUCTION",
			},
		},
		"Acme Frontend": {
			development: {
				NEXT_PUBLIC_API_URL: "http://localhost:3000",
				NEXT_PUBLIC_APP_NAME: "Acme (Dev)",
				AUTH_SECRET: "dev-auth-secret-change-me",
			},
			staging: {
				NEXT_PUBLIC_API_URL: "https://api-staging.acme.example",
				NEXT_PUBLIC_APP_NAME: "Acme (Staging)",
				AUTH_SECRET: "staging-auth-secret-change-me",
			},
			production: {
				NEXT_PUBLIC_API_URL: "https://api.acme.example",
				NEXT_PUBLIC_APP_NAME: "Acme",
				AUTH_SECRET: "CHANGE_ME_IN_PRODUCTION",
			},
		},
	};

	let envVarCount = 0;
	try {
		const vault = await VaultClient.getInstance();
		for (const [appName, envsByType] of Object.entries(envVars)) {
			const appId = appIds[appName];
			for (const [envTypeName, vars] of Object.entries(envsByType)) {
				const etId = envTypeIds[appName][envTypeName];
				for (const [key, value] of Object.entries(vars)) {
					await vault.kvWrite(envPath(orgId, appId, etId, key), { value });
					envVarCount++;
				}
			}
		}
		console.log(`Seed: Wrote ${envVarCount} env vars to Vault`);
	} catch (err) {
		console.warn(`Seed: Failed to write env vars to Vault (is Vault running?): ${err}`);
	}

	if (!dbAlreadySeeded) {
		// -- d) Create 1 team + add dev user as member --
		const teamId = randomUUID();
		await db
			.insertInto("teams")
			.values({
				id: teamId,
				org_id: orgId,
				name: "Backend Team",
				description: "Backend developers",
				color: "#3b82f6",
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		await db
			.insertInto("team_members")
			.values({
				id: randomUUID(),
				team_id: teamId,
				user_id: userId,
				created_at: new Date(),
			})
			.execute();

		console.log(`Seed: Created team "Backend Team" (${teamId})`);

		// -- e) Create 1 API key --
		const apiKey = SecretKeyGenerator.generateKey({ prefix: "eVs" });
		const apiKeyId = randomUUID();
		await db
			.insertInto("api_keys")
			.values({
				id: apiKeyId,
				user_id: userId,
				org_id: orgId,
				description: "Dev CLI Key",
				is_active: true,
				key: apiKey,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		console.log(`Seed: Created API key for dev user (${apiKey})`);

		// -- FGA tuples for seeded resources --
		const fgaTuples: { user: string; relation: string; object: string }[] = [];

		for (const [appName, appId] of Object.entries(appIds)) {
			fgaTuples.push({ user: `org:${orgId}`, relation: "org", object: `app:${appId}` });
			for (const etId of Object.values(envTypeIds[appName])) {
				fgaTuples.push({ user: `app:${appId}`, relation: "app", object: `env_type:${etId}` });
				fgaTuples.push({ user: `org:${orgId}`, relation: "org", object: `env_type:${etId}` });
			}
		}

		fgaTuples.push({ user: `org:${orgId}`, relation: "org", object: `team:${teamId}` });
		fgaTuples.push({ user: `user:${userId}`, relation: "member", object: `team:${teamId}` });

		await writeFGATuples(fgaTuples);
	}

	console.log("Seed: Done.");
}

async function createDevUser() {
	const seedFlag = process.argv.includes("--seed");
	const args = process.argv.slice(3).filter(a => a !== "--seed");
	const email = args[0] || "dev@envsync.local";
	const fullName = args[1] || "Dev User";
	const orgName = "EnvSync Dev";
	const slug = "envsync-dev";

	console.log("EnvSync API: Creating local dev user\n");

	const db = await DB.getInstance();

	// 1. Create or reuse org
	const existingOrg = await db
		.selectFrom("orgs")
		.selectAll()
		.where("slug", "=", slug)
		.executeTakeFirst();

	let orgId: string;
	if (existingOrg) {
		orgId = existingOrg.id;
		console.log(`Org "${orgName}" already exists (${orgId})`);
	} else {
		orgId = randomUUID();
		await db
			.insertInto("orgs")
			.values({
				id: orgId,
				name: orgName,
				slug,
				metadata: {},
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();
		console.log(`Created org "${orgName}" (${orgId})`);
	}

	// 2. Ensure default roles exist
	let adminRole = await db
		.selectFrom("org_role")
		.selectAll()
		.where("org_id", "=", orgId)
		.where("is_master", "=", true)
		.executeTakeFirst();

	if (!adminRole) {
		const roles = [
			{ name: "Org Admin", can_edit: true, can_view: true, have_api_access: true, have_billing_options: true, have_webhook_access: true, is_admin: true, is_master: true, color: "#FF5733" },
			{ name: "Billing Admin", can_edit: false, can_view: false, have_api_access: false, have_billing_options: true, have_webhook_access: false, is_admin: false, is_master: false, color: "#33FF57" },
			{ name: "Manager", can_edit: true, can_view: true, have_api_access: true, have_billing_options: false, have_webhook_access: true, is_admin: false, is_master: false, color: "#3357FF" },
			{ name: "Developer", can_edit: true, can_view: true, have_api_access: false, have_billing_options: false, have_webhook_access: false, is_admin: false, is_master: false, color: "#572F13" },
			{ name: "Viewer", can_edit: false, can_view: true, have_api_access: false, have_billing_options: false, have_webhook_access: false, is_admin: false, is_master: false, color: "#FF33A1" },
		];

		await db
			.insertInto("org_role")
			.values(
				roles.map(r => ({
					id: randomUUID(),
					...r,
					org_id: orgId,
					created_at: new Date(),
					updated_at: new Date(),
				})),
			)
			.execute();

		adminRole = await db
			.selectFrom("org_role")
			.selectAll()
			.where("org_id", "=", orgId)
			.where("is_master", "=", true)
			.executeTakeFirstOrThrow();

		console.log("Created default roles");
	} else {
		console.log("Default roles already exist");
	}

	// 3. Create user in Zitadel + DB
	const existingUser = await db
		.selectFrom("users")
		.selectAll()
		.where("email", "=", email)
		.executeTakeFirst();

	if (existingUser) {
		console.log(`\nUser "${email}" already exists (${existingUser.id})`);

		// Ensure FGA tuples exist even for previously created users
		await assignFGARoles(existingUser.id, orgId, { ...adminRole, is_master: adminRole.is_master ?? false });

		if (seedFlag) {
			await seedData(db, orgId, existingUser.id);
		}

		console.log("\nDev user ready:");
		console.log(`  Email:    ${email}`);
		console.log(`  User ID:  ${existingUser.id}`);
		console.log(`  Org ID:   ${orgId}`);
		console.log(`  Role:     Org Admin`);
		console.log(`  Password: Test@1234`);
		process.exit(0);
	}

	const password = "Test@1234";
	const parts = fullName.trim().split(/\s+/).filter(Boolean);
	const firstName = parts[0]?.slice(0, 200) ?? "User";
	const lastName = parts.slice(1).join(" ").slice(0, 200) || "-";

	// Create user in Zitadel via v2 API
	const { pat } = resolveZitadelPat();
	if (!pat) {
		throw new Error("ZITADEL_PAT (or ZITADEL_PAT_FILE) is required to create a dev user in Zitadel.");
	}
	const zitadelUrl = `${zitadelBase()}/v2/users/human`;
	const zRes = await fetch(zitadelUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${pat}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			username: email,
			profile: { givenName: firstName, familyName: lastName },
			email: { email, isVerified: true },
			password: { password, changeRequired: false },
		}),
	});
	if (!zRes.ok) {
		const text = await zRes.text();
		throw new Error(`Zitadel create user failed: ${zRes.status} ${text}`);
	}
	const zUser = (await zRes.json()) as { userId: string };
	console.log(`Zitadel: user created (${zUser.userId})`);

	const userId = randomUUID();

	await db
		.insertInto("users")
		.values({
			id: userId,
			email,
			org_id: orgId,
			role_id: adminRole.id,
			auth_service_id: zUser.userId,
			full_name: fullName,
			is_active: true,
			profile_picture_url: null,
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

	// Assign FGA roles for the new user
	await assignFGARoles(userId, orgId, { ...adminRole, is_master: adminRole.is_master ?? false });

	if (seedFlag) {
		await seedData(db, orgId, userId);
	}

	console.log(`\nDev user created:`);
	console.log(`  Email:           ${email}`);
	console.log(`  Full Name:       ${fullName}`);
	console.log(`  Password:        ${password}`);
	console.log(`  User ID:         ${userId}`);
	console.log(`  Org:             ${orgName} (${orgId})`);
	console.log(`  Role:            Org Admin (${adminRole.id})`);
	console.log(`  Auth Service ID: ${zUser.userId}`);
}

const cmd = process.argv[2];
if (cmd === "init") {
	await init().catch(err => {
		console.error(err);
		process.exit(1);
	});
} else if (cmd === "create-dev-user") {
	await createDevUser().catch(err => {
		console.error(err);
		process.exit(1);
	});
} else {
	console.log("Usage: bun run scripts/cli.ts <command>\n");
	console.log("Commands:");
	console.log("  init                              Create RustFS bucket + Zitadel OIDC apps");
	console.log("  create-dev-user [email] [name] [--seed]    Create a local dev user (+ seed data with --seed)");
	process.exit(cmd ? 1 : 0);
}

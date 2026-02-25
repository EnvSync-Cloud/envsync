#!/usr/bin/env bun
/**
 * EnvSync API CLI – init RustFS (S3) bucket and retrieve Keycloak client secrets.
 * Run from monorepo root: bun run scripts/cli.ts init (from packages/envsync-api)
 * Or: cd packages/envsync-api && bun run scripts/cli.ts init
 *
 * Keycloak: The realm-export.json auto-imports the "envsync" realm with 3 OIDC clients.
 * This script retrieves their client secrets and writes them to the root .env.
 */

import { randomBytes, randomUUID } from "node:crypto";

import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";

import * as openpgp from "openpgp";

import { config } from "../src/utils/env";
import { updateRootEnv } from "../src/utils/load-root-env";
import { STDBClient } from "../src/libs/stdb";
import { SecretKeyGenerator } from "sk-keygen";

// ── Keycloak Admin helpers (standalone, no app config dependency) ──────

function keycloakBase(): string {
	return config.KEYCLOAK_URL.replace(/\/$/, "");
}

async function getKeycloakAdminToken(): Promise<string> {
	const res = await fetch(
		`${keycloakBase()}/realms/master/protocol/openid-connect/token`,
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "password",
				client_id: "admin-cli",
				username: config.KEYCLOAK_ADMIN_USER,
				password: config.KEYCLOAK_ADMIN_PASSWORD,
			}),
			signal: AbortSignal.timeout(10_000),
		},
	);
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Keycloak admin token failed: ${res.status} ${text}`);
	}
	const data = (await res.json()) as { access_token: string };
	return data.access_token;
}

async function adminFetch(token: string, path: string, options: RequestInit = {}) {
	const realm = config.KEYCLOAK_REALM;
	const url = `${keycloakBase()}/admin/realms/${realm}${path}`;
	return fetch(url, {
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...(options.headers as Record<string, string>),
		},
		signal: options.signal ?? AbortSignal.timeout(10_000),
	});
}

/**
 * Retrieve Keycloak client secret for a confidential client.
 * Returns null for public clients (like CLI).
 */
async function getClientSecret(
	token: string,
	clientId: string,
): Promise<{ internalId: string; secret: string | null }> {
	// Find client by clientId
	const listRes = await adminFetch(token, `/clients?clientId=${encodeURIComponent(clientId)}`);
	if (!listRes.ok) {
		throw new Error(`Keycloak list clients failed: ${listRes.status} ${await listRes.text()}`);
	}
	const clients = (await listRes.json()) as Array<{ id: string; clientId: string; publicClient?: boolean }>;
	const client = clients.find(c => c.clientId === clientId);
	if (!client) {
		throw new Error(`Keycloak client '${clientId}' not found. Ensure realm-export.json was imported.`);
	}

	// Public clients don't have secrets
	if (client.publicClient) {
		return { internalId: client.id, secret: null };
	}

	// Get secret for confidential clients
	const secretRes = await adminFetch(token, `/clients/${client.id}/client-secret`);
	if (!secretRes.ok) {
		throw new Error(`Keycloak get client secret failed: ${secretRes.status} ${await secretRes.text()}`);
	}
	const data = (await secretRes.json()) as { value: string };
	return { internalId: client.id, secret: data.value };
}

async function initKeycloakClients(): Promise<Record<string, string>> {
	const updates: Record<string, string> = {};

	let token: string;
	try {
		token = await getKeycloakAdminToken();
	} catch (err) {
		console.log(`Keycloak: Could not get admin token (${(err as Error).message}). Skipping client setup.`);
		return {};
	}

	console.log("Keycloak: Admin token acquired.");

	// Web client (confidential)
	const web = await getClientSecret(token, config.KEYCLOAK_WEB_CLIENT_ID || "envsync-web");
	if (web.secret) {
		updates.KEYCLOAK_WEB_CLIENT_SECRET = web.secret;
		console.log(`Keycloak: Web client secret retrieved (${config.KEYCLOAK_WEB_CLIENT_ID || "envsync-web"}).`);
	}

	// CLI client (public – no secret)
	await getClientSecret(token, config.KEYCLOAK_CLI_CLIENT_ID || "envsync-cli");
	console.log(`Keycloak: CLI client verified (${config.KEYCLOAK_CLI_CLIENT_ID || "envsync-cli"}, public).`);

	// API client (confidential)
	const api = await getClientSecret(token, config.KEYCLOAK_API_CLIENT_ID || "envsync-api");
	if (api.secret) {
		updates.KEYCLOAK_API_CLIENT_SECRET = api.secret;
		console.log(`Keycloak: API client secret retrieved (${config.KEYCLOAK_API_CLIENT_ID || "envsync-api"}).`);
	}

	return updates;
}

// ── RustFS init ─────────────────────────────────────────────────────

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
			await client.send(new CreateBucketCommand({ Bucket: bucket, ACL: "public-read" }));
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

// ── STDB Root Key init ─────────────────────────────────────────────

async function initSTDBRootKey() {
	if (config.STDB_ROOT_KEY) {
		console.log("SpacetimeDB: STDB_ROOT_KEY already set, skipping generation.");
		return;
	}
	const rootKey = randomBytes(32).toString("hex");
	console.log("SpacetimeDB: root key generated");

	updateRootEnv({
		STDB_ROOT_KEY: rootKey,
	});
	console.log("SpacetimeDB: root key written to root .env");
}

// ── Init command ────────────────────────────────────────────────────

async function init() {
	console.log("EnvSync API init: RustFS bucket + Keycloak client secrets\n");

	await initRustfsBucket();

	const envUpdates = await initKeycloakClients();
	if (Object.keys(envUpdates).length > 0) {
		updateRootEnv(envUpdates);
		console.log("Keycloak: wrote client secrets to root .env");
	}

	await initSTDBRootKey();

	console.log("\nInit done.");
}

// ── Auth tuple helpers (standalone, uses STDB directly) ─────────────

async function writeAuthTuples(
	stdb: ReturnType<typeof STDBClient.getInstance>,
	tuples: { subject: string; relation: string; object_type: string; object_id: string }[],
): Promise<void> {
	if (tuples.length === 0) return;
	await stdb.callReducer("write_auth_tuples", [JSON.stringify(tuples)], { injectRootKey: false });
	console.log(`  Auth: ${tuples.length} tuples written.`);
}

async function assignRoleTuples(
	stdb: ReturnType<typeof STDBClient.getInstance>,
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
		have_gpg_access?: boolean;
		have_cert_access?: boolean;
		have_audit_access?: boolean;
	},
): Promise<void> {
	const subject = `user:${userId}`;
	const tuples: { subject: string; relation: string; object_type: string; object_id: string }[] = [];

	tuples.push({ subject, relation: "member", object_type: "org", object_id: orgId });
	if (role.is_master) tuples.push({ subject, relation: "master", object_type: "org", object_id: orgId });
	if (role.is_admin) tuples.push({ subject, relation: "admin", object_type: "org", object_id: orgId });
	if (role.can_view) tuples.push({ subject, relation: "can_view", object_type: "org", object_id: orgId });
	if (role.can_edit) tuples.push({ subject, relation: "can_edit", object_type: "org", object_id: orgId });
	if (role.have_api_access) tuples.push({ subject, relation: "have_api_access", object_type: "org", object_id: orgId });
	if (role.have_billing_options) tuples.push({ subject, relation: "have_billing_options", object_type: "org", object_id: orgId });
	if (role.have_webhook_access) tuples.push({ subject, relation: "have_webhook_access", object_type: "org", object_id: orgId });
	if (role.have_gpg_access) tuples.push({ subject, relation: "have_gpg_access", object_type: "org", object_id: orgId });
	if (role.have_cert_access) tuples.push({ subject, relation: "have_cert_access", object_type: "org", object_id: orgId });
	if (role.have_audit_access) tuples.push({ subject, relation: "have_audit_access", object_type: "org", object_id: orgId });

	await writeAuthTuples(stdb, tuples);
}

// ── Seed data ───────────────────────────────────────────────────────

async function seedData(stdb: ReturnType<typeof STDBClient.getInstance>, orgId: string, userId: string): Promise<void> {
	console.log("\nSeed: Populating sample data...");

	const apps = [
		{ name: "Acme Backend", description: "Core backend API service" },
		{ name: "Acme Frontend", description: "Next.js web application" },
	];

	const envTypeDefs = [
		{ name: "development", color: "#22c55e", is_default: true, is_protected: false },
		{ name: "staging", color: "#f59e0b", is_default: false, is_protected: false },
		{ name: "production", color: "#ef4444", is_default: false, is_protected: true },
	];

	// Check if already seeded
	const existingApps = await stdb.query<{ uuid: string; name: string }>(
		`SELECT uuid, name FROM app WHERE org_id = '${orgId}'`,
	);
	const dbAlreadySeeded = existingApps.some(a => a.name === "Acme Backend");

	const appIds: Record<string, string> = {};
	const envTypeIds: Record<string, Record<string, string>> = {};

	if (dbAlreadySeeded) {
		console.log("Seed: Sample apps already exist, skipping STDB inserts.");
		for (const app of apps) {
			const row = existingApps.find(a => a.name === app.name);
			if (row) appIds[app.name] = row.uuid;
		}
		for (const [appName, appId] of Object.entries(appIds)) {
			envTypeIds[appName] = {};
			const ets = await stdb.query<{ uuid: string; name: string }>(
				`SELECT uuid, name FROM env_type WHERE app_id = '${appId}'`,
			);
			for (const et of envTypeDefs) {
				const row = ets.find(e => e.name === et.name);
				if (row) envTypeIds[appName][et.name] = row.uuid;
			}
		}
	} else {
		for (const app of apps) {
			const appId = randomUUID();
			const now = new Date().toISOString();
			await stdb.callReducer("create_app", [
				appId, app.name, orgId, app.description,
				JSON.stringify({}), false, false, null, null,
			]);
			appIds[app.name] = appId;
			console.log(`Seed: Created app "${app.name}" (${appId})`);
		}

		for (const [appName, appId] of Object.entries(appIds)) {
			envTypeIds[appName] = {};
			for (const et of envTypeDefs) {
				const etId = randomUUID();
				const now = new Date().toISOString();
				await stdb.callReducer("create_env_type", [
					etId, et.name, orgId, appId, et.color,
					et.is_default, et.is_protected, now, now,
				]);
				envTypeIds[appName][et.name] = etId;
			}
			console.log(`Seed: Created env types for "${appName}"`);
		}
	}

	// Write sample env vars to SpacetimeDB (always attempted)
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
	const stdbHealthy = await stdb.healthCheck();
	if (!stdbHealthy) {
		throw new Error("Seed: SpacetimeDB is not healthy. Cannot seed without encryption.");
	}

	for (const [appName, envsByType] of Object.entries(envVars)) {
		const appId = appIds[appName];
		for (const [envTypeName, vars] of Object.entries(envsByType)) {
			const etId = envTypeIds[appName][envTypeName];
			for (const [key, value] of Object.entries(vars)) {
				await stdb.callReducer("create_env", [orgId, appId, etId, key, value]);
				envVarCount++;
			}
		}
	}
	console.log(`Seed: Wrote ${envVarCount} env vars to SpacetimeDB`);

	if (!dbAlreadySeeded) {
		// Create team + member
		const teamId = randomUUID();
		const now = new Date().toISOString();
		await stdb.callReducer("create_team", [
			teamId, "Backend Team", orgId, "Backend developers", "#3b82f6", now, now,
		]);
		const teamMemberId = randomUUID();
		await stdb.callReducer("create_team_member", [teamMemberId, teamId, userId, now]);
		console.log(`Seed: Created team "Backend Team" (${teamId})`);

		// Create API key
		const apiKey = SecretKeyGenerator.generateKey({ prefix: "eVs" });
		const apiKeyId = randomUUID();
		await stdb.callReducer("create_api_key", [
			apiKeyId, userId, orgId, "Dev CLI Key", apiKey, now, now,
		]);
		console.log(`Seed: Created API key for dev user (${apiKey})`);

		// Fetch user details for GPG + cert
		const devUser = await stdb.queryOne<{ email: string; full_name: string }>(
			`SELECT email, full_name FROM user WHERE uuid = '${userId}'`,
		);

		if (devUser) {
			// Create a sample GPG key
			let gpgKeyId: string | null = null;
			try {
				const passphrase = randomBytes(32).toString("hex");
				const { privateKey, publicKey } = await openpgp.generateKey({
					type: "ecc",
					curve: "ed25519Legacy",
					userIDs: [{ name: devUser.full_name || "Dev User", email: devUser.email }],
					passphrase,
					format: "armored",
				});

				const parsedPublic = await openpgp.readKey({ armoredKey: publicKey });
				const fingerprint = parsedPublic.getFingerprint().toUpperCase();
				const keyIdStr = fingerprint.slice(-16);

				// Store GPG material in SpacetimeDB
				await stdb.callReducer("store_gpg_material", [orgId, fingerprint, privateKey, passphrase]);

				gpgKeyId = randomUUID();
				await stdb.callReducer("create_gpg_key_record", [
					gpgKeyId, orgId, userId, "Dev Signing Key", devUser.email,
					fingerprint, keyIdStr, "ecc-curve25519", 0, publicKey,
					`stdb:gpg:${orgId}:${fingerprint}`,
					JSON.stringify(["sign", "certify"]), "ultimate",
					"", true,
				]);

				console.log(`Seed: Created GPG key (${fingerprint.slice(0, 16)}...)`);
			} catch (err) {
				console.warn("Seed: Failed to create sample GPG key:", (err as Error).message);
			}

			// Initialize org CA + issue member cert
			try {
				const caResultJson = await stdb.callReducer<string>("create_org_ca", [orgId, "EnvSync Dev"]);
				const caResult = JSON.parse(caResultJson);

				await stdb.callReducer("create_cert_record", [
					randomUUID(), orgId, userId, caResult.serial_hex, "org_ca",
					"EnvSync Dev CA", "", "active", "Dev organization CA",
				]);

				console.log(`Seed: Initialized org CA (serial: ${caResult.serial_hex})`);

				const memberResultJson = await stdb.callReducer<string>("issue_member_cert", [userId, devUser.email, orgId, "admin"]);
				const memberResult = JSON.parse(memberResultJson);

				await stdb.callReducer("create_cert_record", [
					randomUUID(), orgId, userId, memberResult.serial_hex, "member",
					devUser.email, devUser.email, "active", "Dev user member certificate",
				]);

				console.log(`Seed: Issued member certificate for ${devUser.email}`);
			} catch (err) {
				console.warn("Seed: Failed to create certificates (SpacetimeDB PKI may not be available):", (err as Error).message);
			}

			// Auth tuples for seeded resources
			const authTuples: { subject: string; relation: string; object_type: string; object_id: string }[] = [];

			for (const [appName, appId] of Object.entries(appIds)) {
				authTuples.push({ subject: `org:${orgId}`, relation: "org", object_type: "app", object_id: appId });
				for (const etId of Object.values(envTypeIds[appName])) {
					authTuples.push({ subject: `app:${appId}`, relation: "app", object_type: "env_type", object_id: etId });
					authTuples.push({ subject: `org:${orgId}`, relation: "org", object_type: "env_type", object_id: etId });
				}
			}

			authTuples.push({ subject: `org:${orgId}`, relation: "org", object_type: "team", object_id: teamId });
			authTuples.push({ subject: `user:${userId}`, relation: "member", object_type: "team", object_id: teamId });

			if (gpgKeyId) {
				authTuples.push({ subject: `org:${orgId}`, relation: "org", object_type: "gpg_key", object_id: gpgKeyId });
				authTuples.push({ subject: `user:${userId}`, relation: "owner", object_type: "gpg_key", object_id: gpgKeyId });
			}

			await writeAuthTuples(stdb, authTuples);
		}
	}

	console.log("Seed: Done.");
}

// ── Create dev user ─────────────────────────────────────────────────

async function createDevUser() {
	const seedFlag = process.argv.includes("--seed");
	const args = process.argv.slice(3).filter(a => a !== "--seed");
	const email = args[0] || "dev@envsync.local";
	const fullName = args[1] || "Dev User";
	const orgName = "EnvSync Dev";
	const slug = "envsync-dev";

	console.log("EnvSync API: Creating local dev user\n");

	const stdb = STDBClient.getInstance();

	// 1. Create or reuse org
	const existingOrg = await stdb.queryOne<{ uuid: string }>(
		`SELECT uuid FROM org WHERE slug = '${slug}'`,
	);

	let orgId: string;
	if (existingOrg) {
		orgId = existingOrg.uuid;
		console.log(`Org "${orgName}" already exists (${orgId})`);
	} else {
		orgId = randomUUID();
		await stdb.callReducer("create_org", [
			orgId, orgName, slug, "", "", "", JSON.stringify({}),
		], { injectRootKey: false });
		console.log(`Created org "${orgName}" (${orgId})`);
	}

	// 2. Ensure default roles exist
	let adminRole = await stdb.queryOne<{
		uuid: string;
		is_master: boolean;
		is_admin: boolean;
		can_view: boolean;
		can_edit: boolean;
		have_api_access: boolean;
		have_billing_options: boolean;
		have_webhook_access: boolean;
		have_gpg_access: boolean;
		have_cert_access: boolean;
		have_audit_access: boolean;
	}>(`SELECT * FROM org_role WHERE org_id = '${orgId}' AND is_master = true`);

	if (!adminRole) {
		const roles = [
			{ name: "Org Admin", can_edit: true, can_view: true, have_api_access: true, have_billing_options: true, have_webhook_access: true, have_gpg_access: true, have_cert_access: true, have_audit_access: true, is_admin: true, is_master: true, color: "#FF5733" },
			{ name: "Billing Admin", can_edit: false, can_view: false, have_api_access: false, have_billing_options: true, have_webhook_access: false, have_gpg_access: false, have_cert_access: false, have_audit_access: false, is_admin: false, is_master: false, color: "#33FF57" },
			{ name: "Manager", can_edit: true, can_view: true, have_api_access: true, have_billing_options: false, have_webhook_access: true, have_gpg_access: false, have_cert_access: false, have_audit_access: true, is_admin: false, is_master: false, color: "#3357FF" },
			{ name: "Developer", can_edit: true, can_view: true, have_api_access: false, have_billing_options: false, have_webhook_access: false, have_gpg_access: false, have_cert_access: false, have_audit_access: false, is_admin: false, is_master: false, color: "#572F13" },
			{ name: "Viewer", can_edit: false, can_view: true, have_api_access: false, have_billing_options: false, have_webhook_access: false, have_gpg_access: false, have_cert_access: false, have_audit_access: false, is_admin: false, is_master: false, color: "#FF33A1" },
		];

		for (const r of roles) {
			const roleId = randomUUID();
			await stdb.callReducer("create_org_role", [
				roleId, r.name, orgId, r.color,
				r.is_admin, r.is_master, r.can_view, r.can_edit,
				r.have_api_access, r.have_billing_options, r.have_webhook_access,
				r.have_gpg_access, r.have_cert_access, r.have_audit_access,
			], { injectRootKey: false });
		}

		adminRole = await stdb.queryOne<typeof adminRole>(
			`SELECT * FROM org_role WHERE org_id = '${orgId}' AND is_master = true`,
		);

		console.log("Created default roles");
	} else {
		console.log("Default roles already exist");
	}

	if (!adminRole) throw new Error("Failed to find admin role after creation");

	// 3. Create user in Keycloak + STDB
	const existingUser = await stdb.queryOne<{ uuid: string }>(
		`SELECT uuid FROM user WHERE email = '${email}'`,
	);

	if (existingUser) {
		console.log(`\nUser "${email}" already exists (${existingUser.uuid})`);

		// Ensure auth tuples exist even for previously created users
		await assignRoleTuples(stdb, existingUser.uuid, orgId, adminRole);

		if (seedFlag) {
			await seedData(stdb, orgId, existingUser.uuid);
		}

		console.log("\nDev user ready:");
		console.log(`  Email:    ${email}`);
		console.log(`  User ID:  ${existingUser.uuid}`);
		console.log(`  Org ID:   ${orgId}`);
		console.log(`  Role:     Org Admin`);
		console.log(`  Password: Test@1234`);
		process.exit(0);
	}

	const password = "Test@1234";
	const parts = fullName.trim().split(/\s+/).filter(Boolean);
	const firstName = parts[0]?.slice(0, 200) ?? "User";
	const lastName = parts.slice(1).join(" ").slice(0, 200) || "-";

	// Create user in Keycloak
	const token = await getKeycloakAdminToken();
	const kcRes = await adminFetch(token, "/users", {
		method: "POST",
		body: JSON.stringify({
			username: email,
			email,
			emailVerified: true,
			enabled: true,
			firstName,
			lastName,
			credentials: [{
				type: "password",
				value: password,
				temporary: false,
			}],
		}),
	});
	if (!kcRes.ok) {
		const text = await kcRes.text();
		throw new Error(`Keycloak create user failed: ${kcRes.status} ${text}`);
	}
	const location = kcRes.headers.get("Location") ?? "";
	const keycloakUserId = location.split("/").pop() ?? "";
	if (!keycloakUserId) throw new Error("Keycloak create user: missing user ID in Location header");
	console.log(`Keycloak: user created (${keycloakUserId})`);

	const userId = randomUUID();
	const now = new Date().toISOString();

	await stdb.callReducer("create_user", [
		userId, email, fullName, orgId, adminRole.uuid,
		keycloakUserId, true, "",
	], { injectRootKey: false });

	// Assign auth tuples for the new user
	await assignRoleTuples(stdb, userId, orgId, adminRole);

	if (seedFlag) {
		await seedData(stdb, orgId, userId);
	}

	console.log(`\nDev user created:`);
	console.log(`  Email:           ${email}`);
	console.log(`  Full Name:       ${fullName}`);
	console.log(`  Password:        ${password}`);
	console.log(`  User ID:         ${userId}`);
	console.log(`  Org:             ${orgName} (${orgId})`);
	console.log(`  Role:            Org Admin (${adminRole.uuid})`);
	console.log(`  Auth Service ID: ${keycloakUserId}`);
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
	console.log("  init                              Create RustFS bucket + retrieve Keycloak client secrets");
	console.log("  create-dev-user [email] [name] [--seed]    Create a local dev user (+ seed data with --seed)");
	process.exit(cmd ? 1 : 0);
}

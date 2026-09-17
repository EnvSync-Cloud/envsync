#!/usr/bin/env bun

import { CreateBucketCommand, PutBucketPolicyCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { config } from "../src/utils/env";
import { updateRootEnv } from "../src/utils/load-root-env";
import { DB } from "../src/libs/db";
import {
	createKeycloakUser,
	findKeycloakUserByUsername,
	getKeycloakBaseUrl,
	getKeycloakRealm,
	getKeycloakUserById,
	setKeycloakUserPassword,
} from "../src/helpers/keycloak";

const repoRoot = path.resolve(import.meta.dir, "..", "..", "..");
const localRealmImportPath = path.join(repoRoot, "docker/keycloak/realm-import/envsync-realm.json");

function buildPublicReadBucketPolicy(bucket: string) {
	return JSON.stringify({
		Version: "2012-10-17",
		Statement: [
			{
				Sid: "AllowPublicReadObjects",
				Effect: "Allow",
				Principal: "*",
				Action: ["s3:GetObject"],
				Resource: [`arn:aws:s3:::${bucket}/*`],
			},
		],
	});
}

async function initRustfsBucket() {
	const client = new S3Client({
		region: config.S3_REGION,
		endpoint: config.S3_ENDPOINT,
		forcePathStyle: true,
		credentials: {
			accessKeyId: config.S3_ACCESS_KEY,
			secretAccessKey: config.S3_SECRET_KEY,
		},
	});

	try {
		await client.send(new CreateBucketCommand({ Bucket: config.S3_BUCKET, ACL: "public-read" }));
		console.log(`RustFS: bucket ${config.S3_BUCKET} created.`);
	} catch (error) {
		const err = error as { name?: string; Code?: string };
		if (err?.name === "BucketAlreadyOwnedByYou" || err?.Code === "BucketAlreadyOwnedByYou") {
			console.log(`RustFS: bucket ${config.S3_BUCKET} already exists.`);
		} else {
			throw error;
		}
	}

	await client.send(
		new PutBucketPolicyCommand({
			Bucket: config.S3_BUCKET,
			Policy: buildPublicReadBucketPolicy(config.S3_BUCKET),
		}),
	);
	console.log(`RustFS: public read policy applied to bucket ${config.S3_BUCKET}.`);
}

async function getAdminToken() {
	const res = await fetch(`${getKeycloakBaseUrl()}/realms/master/protocol/openid-connect/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "password",
			client_id: "admin-cli",
			username: config.KEYCLOAK_ADMIN_USER,
			password: config.KEYCLOAK_ADMIN_PASSWORD,
		}),
	});
	if (!res.ok) throw new Error(`Keycloak admin login failed: ${res.status} ${await res.text()}`);
	return (await res.json()) as { access_token: string };
}

async function ensureKeycloakRealmSessionSettings(token: string) {
	const base = `${getKeycloakBaseUrl()}/admin/realms/${getKeycloakRealm()}`;
	const lookup = await fetch(base, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!lookup.ok)
		throw new Error(`Keycloak realm lookup failed: ${lookup.status} ${await lookup.text()}`);

	const realm = (await lookup.json()) as Record<string, unknown>;
	const updateRes = await fetch(base, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			...realm,
			accessTokenLifespan: Number(config.KEYCLOAK_ACCESS_TOKEN_LIFESPAN_SECONDS),
			ssoSessionIdleTimeout: Number(config.KEYCLOAK_SSO_SESSION_IDLE_TIMEOUT_SECONDS),
			ssoSessionMaxLifespan: Number(config.KEYCLOAK_SSO_SESSION_MAX_LIFESPAN_SECONDS),
			clientSessionIdleTimeout: Number(config.KEYCLOAK_CLIENT_SESSION_IDLE_TIMEOUT_SECONDS),
			clientSessionMaxLifespan: Number(config.KEYCLOAK_CLIENT_SESSION_MAX_LIFESPAN_SECONDS),
		}),
	});
	if (!updateRes.ok && updateRes.status !== 204) {
		throw new Error(`Keycloak realm update failed: ${updateRes.status} ${await updateRes.text()}`);
	}
}

function loadImportedRealmClients() {
	if (!fs.existsSync(localRealmImportPath)) return null;

	const parsed = JSON.parse(fs.readFileSync(localRealmImportPath, "utf8")) as {
		clients?: Array<{
			clientId?: string;
			publicClient?: boolean;
			secret?: string;
		}>;
	};

	const clients = parsed.clients ?? [];
	const web = clients.find(client => client.clientId === config.KEYCLOAK_WEB_CLIENT_ID);
	const api = clients.find(client => client.clientId === config.KEYCLOAK_API_CLIENT_ID);
	const cli = clients.find(client => client.clientId === config.KEYCLOAK_CLI_CLIENT_ID);

	if (!web?.secret || !api?.secret || !cli) return null;

	return {
		web: { clientId: config.KEYCLOAK_WEB_CLIENT_ID, clientSecret: web.secret },
		api: { clientId: config.KEYCLOAK_API_CLIENT_ID, clientSecret: api.secret },
		cli: { clientId: config.KEYCLOAK_CLI_CLIENT_ID, clientSecret: "" },
	};
}

async function ensureKeycloakClient(
	token: string,
	clientId: string,
	opts: {
		publicClient: boolean;
		redirectUris: string[];
		standardFlowEnabled: boolean;
		directAccessGrantsEnabled?: boolean;
		deviceGrant?: boolean;
		webOrigins?: string[];
		attributes?: Record<string, string>;
	},
) {
	const base = `${getKeycloakBaseUrl()}/admin/realms/${getKeycloakRealm()}`;
	const lookup = await fetch(`${base}/clients?clientId=${encodeURIComponent(clientId)}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!lookup.ok)
		throw new Error(`Keycloak client lookup failed: ${lookup.status} ${await lookup.text()}`);
	const existing = ((await lookup.json()) as Array<{ id: string }>)[0];
	if (existing?.id) {
		const updateRes = await fetch(`${base}/clients/${existing.id}`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				clientId,
				name: clientId,
				protocol: "openid-connect",
				publicClient: opts.publicClient,
				standardFlowEnabled: opts.standardFlowEnabled,
				directAccessGrantsEnabled: opts.directAccessGrantsEnabled ?? false,
				serviceAccountsEnabled: false,
				redirectUris: opts.redirectUris,
				webOrigins: opts.webOrigins ?? ["*"],
				attributes: {
					...(opts.attributes ?? {}),
					...(opts.deviceGrant ? { "oauth2.device.authorization.grant.enabled": "true" } : {}),
				},
			}),
		});
		if (!updateRes.ok && updateRes.status !== 204) {
			throw new Error(
				`Keycloak client update failed: ${updateRes.status} ${await updateRes.text()}`,
			);
		}
		if (opts.publicClient) return { clientId, clientSecret: "" };
		const secretRes = await fetch(`${base}/clients/${existing.id}/client-secret`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const secretData = (await secretRes.json()) as { value: string };
		return { clientId, clientSecret: secretData.value };
	}

	const createRes = await fetch(`${base}/clients`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			clientId,
			name: clientId,
			protocol: "openid-connect",
			publicClient: opts.publicClient,
			standardFlowEnabled: opts.standardFlowEnabled,
			directAccessGrantsEnabled: opts.directAccessGrantsEnabled ?? false,
			serviceAccountsEnabled: false,
			redirectUris: opts.redirectUris,
			webOrigins: opts.webOrigins ?? ["*"],
			attributes: {
				...(opts.attributes ?? {}),
				...(opts.deviceGrant ? { "oauth2.device.authorization.grant.enabled": "true" } : {}),
			},
		}),
	});
	if (!createRes.ok && createRes.status !== 201) {
		throw new Error(`Keycloak client create failed: ${createRes.status} ${await createRes.text()}`);
	}

	return ensureKeycloakClient(token, clientId, opts);
}

async function initKeycloakClients() {
	let web: { clientId: string; clientSecret: string };
	let api: { clientId: string; clientSecret: string };
	let cli: { clientId: string; clientSecret: string };

	try {
		const { access_token } = await getAdminToken();
		await ensureKeycloakRealmSessionSettings(access_token);
		const webCallbackOrigin = new URL(config.KEYCLOAK_WEB_CALLBACK_URL).origin;
		web = await ensureKeycloakClient(access_token, config.KEYCLOAK_WEB_CLIENT_ID, {
			publicClient: false,
			redirectUris: [
				config.KEYCLOAK_WEB_REDIRECT_URI,
				config.KEYCLOAK_WEB_CALLBACK_URL,
				webCallbackOrigin,
			],
			standardFlowEnabled: true,
			directAccessGrantsEnabled: true,
			webOrigins: [webCallbackOrigin],
			attributes: { "post.logout.redirect.uris": "+" },
		});
		api = await ensureKeycloakClient(access_token, config.KEYCLOAK_API_CLIENT_ID, {
			publicClient: false,
			redirectUris: [config.KEYCLOAK_API_REDIRECT_URI],
			standardFlowEnabled: true,
		});
		cli = await ensureKeycloakClient(access_token, config.KEYCLOAK_CLI_CLIENT_ID, {
			publicClient: true,
			redirectUris: [],
			standardFlowEnabled: false,
			deviceGrant: true,
		});
	} catch (error) {
		const imported = loadImportedRealmClients();
		if (!imported) {
			throw error;
		}
		web = imported.web;
		api = imported.api;
		cli = imported.cli;
		console.log(
			"Keycloak: admin bootstrap unavailable locally, using imported realm client definitions.",
		);
	}

	updateRootEnv({
		KEYCLOAK_WEB_CLIENT_ID: web.clientId,
		KEYCLOAK_WEB_CLIENT_SECRET: web.clientSecret,
		KEYCLOAK_API_CLIENT_ID: api.clientId,
		KEYCLOAK_API_CLIENT_SECRET: api.clientSecret,
		KEYCLOAK_CLI_CLIENT_ID: cli.clientId,
	});
	console.log("Keycloak: clients bootstrapped and written to root .env");
}

async function init() {
	await initRustfsBucket();
	await initKeycloakClients();
	console.log("\nInit done.");
}

const DEV_ORG_NAME = "EnvSync Dev";
const DEV_ORG_SLUG = "envsync-dev";
const DEV_USER_PASSWORD = "Test@1234";

function isSeededVaultRepairFailure(error: unknown) {
	return (
		error instanceof Error &&
		error.message.includes("Seed vault access still invalid after certificate/session repair")
	);
}

function buildRecoveryOrgSlug(baseSlug: string) {
	return `${baseSlug}-${Date.now().toString(36)}`;
}

function buildTemporaryBootstrapEmail(email: string) {
	const [localPart, domainPart] = email.split("@");
	const normalizedLocalPart = (localPart || "envsync").replace(/[^a-zA-Z0-9._-]+/g, "-");
	const normalizedDomainPart = domainPart || "envsync.local";
	return `${normalizedLocalPart}-bootstrap-${Date.now().toString(36)}@${normalizedDomainPart}`;
}

async function ensureDevOrg(
	orgName = DEV_ORG_NAME,
	orgSlug = DEV_ORG_SLUG,
	bootstrapUser: {
		email: string;
		full_name: string;
		password: string;
	} = {
		email: "dev@envsync.local",
		full_name: "EnvSync Dev",
		password: DEV_USER_PASSWORD,
	},
) {
	const db = await DB.getInstance();
	let org = await db.selectFrom("orgs").selectAll().where("slug", "=", orgSlug).executeTakeFirst();
	if (!org) {
		const localBootstrapUser = await db
			.selectFrom("users")
			.select(["id"])
			.where("email", "=", bootstrapUser.email)
			.executeTakeFirst();
		const existingKeycloakBootstrapUser = localBootstrapUser
			? null
			: await findKeycloakUserByUsername(bootstrapUser.email);
		const shouldUseTemporaryBootstrapUser = Boolean(
			localBootstrapUser || existingKeycloakBootstrapUser,
		);
		const provisioningBootstrapUser = shouldUseTemporaryBootstrapUser
			? {
					email: buildTemporaryBootstrapEmail(bootstrapUser.email),
					full_name: `${bootstrapUser.full_name} Bootstrap`,
					password: bootstrapUser.password,
				}
			: bootstrapUser;
		if (shouldUseTemporaryBootstrapUser) {
			const collisionReason = localBootstrapUser
				? "already exists locally"
				: "already exists in Keycloak without a local user row";
			console.warn(
				`Bootstrap user ${bootstrapUser.email} ${collisionReason}; provisioning org ${orgSlug} with temporary bootstrap user ${provisioningBootstrapUser.email}.`,
			);
		}
		const { OrgProvisioningService } = await import("../src/services/org-provisioning.service");
		const provisioned = await OrgProvisioningService.provisionOrganization({
			org: {
				name: orgName,
				slug: orgSlug,
				metadata: { seeded_by: "cli" },
			},
			adminUser: provisioningBootstrapUser,
			source: "cli_bootstrap",
		});
		org = await db
			.selectFrom("orgs")
			.selectAll()
			.where("id", "=", provisioned.org_id)
			.executeTakeFirstOrThrow();
		console.log(`Created org "${orgName}" (${org.id})`);
	}

	return org;
}

async function ensureDefaultRoles(orgId: string) {
	const db = await DB.getInstance();
	const existingRoles = await db
		.selectFrom("org_role")
		.selectAll()
		.where("org_id", "=", orgId)
		.execute();

	if (existingRoles.length === 0) {
		const { RoleService } = await import("../src/services/role.service");
		await RoleService.createDefaultRoles(orgId);
		console.log("Created default roles");
	}

	return db.selectFrom("org_role").selectAll().where("org_id", "=", orgId).execute();
}

function getFlagValue(rawArgs: string[], flagName: string) {
	const inlinePrefix = `--${flagName}=`;
	for (let index = 0; index < rawArgs.length; index += 1) {
		const arg = rawArgs[index];
		if (arg.startsWith(inlinePrefix)) {
			return arg.slice(inlinePrefix.length);
		}
		if (arg === `--${flagName}`) {
			return rawArgs[index + 1];
		}
	}

	return undefined;
}

function normalizeRoleName(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, " ");
}

function resolveRequestedRole(
	roles: Array<{ id: string; name: string; is_master: boolean }>,
	requestedRole: string | undefined,
) {
	if (!requestedRole) {
		return roles.find(role => role.is_master) ?? null;
	}

	const normalizedRequestedRole = normalizeRoleName(requestedRole);
	const roleAliases = new Map<string, string>([
		["master", "Org Admin"],
		["org admin", "Org Admin"],
		["admin", "Org Admin"],
		["billing admin", "Billing Admin"],
		["manager", "Manager"],
		["editor", "Developer"],
		["developer", "Developer"],
		["viewer", "Viewer"],
	]);
	const resolvedRoleName = roleAliases.get(normalizedRequestedRole) ?? requestedRole;
	const normalizedRoleName = normalizeRoleName(resolvedRoleName);

	return roles.find(role => normalizeRoleName(role.name) === normalizedRoleName) ?? null;
}

async function ensureUserRoleAccess(userId: string, orgId: string, roleId: string) {
	const { AuthorizationService } = await import("../src/services/authorization.service");
	await AuthorizationService.resyncUserRole(userId, orgId, roleId);
}

async function ensureOrgResourceAccess(orgId: string) {
	const { AuthorizationService } = await import("../src/services/authorization.service");
	const db = await DB.getInstance();

	const [apps, envTypes] = await Promise.all([
		db.selectFrom("app").select(["id", "org_id"]).where("org_id", "=", orgId).execute(),
		db
			.selectFrom("env_type")
			.select(["id", "app_id", "org_id"])
			.where("org_id", "=", orgId)
			.execute(),
	]);

	for (const app of apps) {
		await AuthorizationService.writeAppOrgRelation(app.id, app.org_id);
	}

	for (const envType of envTypes) {
		await AuthorizationService.writeEnvTypeRelations(envType.id, envType.app_id, envType.org_id);
	}

	console.log(
		`OpenFGA resource relations synced for ${apps.length} apps and ${envTypes.length} env types`,
	);
}

function isMissingOrgCAError(error: unknown) {
	return (
		error instanceof Error &&
		error.message.includes("org CA") &&
		error.message.includes("not found")
	);
}

async function repairSeededOrgCertificates(orgId: string) {
	const { AuthorizationService } = await import("../src/services/authorization.service");
	const { invalidateCache } = await import("../src/helpers/cache");
	const { CacheKeys } = await import("../src/helpers/cache-keys");
	const { KMSClient } = await import("../src/libs/kms/client");
	const db = await DB.getInstance();

	const certs = await db
		.selectFrom("org_certificates")
		.select(["id", "user_id"])
		.where("org_id", "=", orgId)
		.execute();

	for (const cert of certs) {
		await AuthorizationService.deleteResourceTuples("certificate", cert.id).catch(() => {});
	}

	await db.deleteFrom("org_certificates").where("org_id", "=", orgId).execute();
	await invalidateCache(CacheKeys.certsByOrg(orgId));

	const affectedUsers = [...new Set(certs.map(cert => cert.user_id))];
	const { invalidateSessionToken } = await import("../src/libs/kms/session-manager");
	const kms = await KMSClient.getInstance();
	for (const affectedUserId of affectedUsers) {
		await kms.revokeMemberSessions(affectedUserId, orgId).catch(() => 0);
		invalidateSessionToken(affectedUserId, orgId);
	}

	console.log("Repaired stale organization certificate state after miniKMS reset");
}

async function refreshVaultSession(userId: string, orgId: string) {
	const { KMSClient } = await import("../src/libs/kms/client");
	const { getVaultSessionToken, invalidateSessionToken } =
		await import("../src/libs/kms/session-manager");

	const kms = await KMSClient.getInstance();
	await kms.revokeMemberSessions(userId, orgId).catch(() => 0);
	invalidateSessionToken(userId, orgId);

	const sessionToken = await getVaultSessionToken(userId, orgId);
	const session = await kms.validateSession(sessionToken);

	if (!session.valid) {
		throw new Error(`Seed vault session invalid after refresh for user ${userId} in org ${orgId}`);
	}

	return sessionToken;
}

async function moveUserToOrg(
	userId: string,
	nextOrgId: string,
	roleId: string,
	previousOrgId?: string,
) {
	const { invalidateSessionToken } = await import("../src/libs/kms/session-manager");
	const db = await DB.getInstance();
	if (previousOrgId) {
		invalidateSessionToken(userId, previousOrgId);
	}
	invalidateSessionToken(userId, nextOrgId);
	await db
		.updateTable("users")
		.set({
			org_id: nextOrgId,
			role_id: roleId,
			updated_at: new Date(),
		})
		.where("id", "=", userId)
		.execute();
}

async function ensureOrgCertificates(
	orgId: string,
	orgName: string,
	userId: string,
	email: string,
) {
	const { CertificateService } = await import("../src/services/certificate.service");
	const { CertificateRoleMapper } = await import("../src/services/certificate-role.mapper");
	const { KMSClient } = await import("../src/libs/kms/client");
	const { getVaultSessionToken, invalidateSessionToken } =
		await import("../src/libs/kms/session-manager");
	const { RoleService } = await import("../src/services/role.service");
	const db = await DB.getInstance();

	let orgCA: Awaited<ReturnType<typeof CertificateService.getOrgCA>> | null =
		await CertificateService.getOrgCA(orgId);
	if (orgCA) {
		try {
			const kms = await KMSClient.getInstance();
			await kms.getCRL(orgId, false);
		} catch (error) {
			if (!isMissingOrgCAError(error)) {
				throw error;
			}
			await repairSeededOrgCertificates(orgId);
			orgCA = null;
		}
	}

	if (!orgCA) {
		await CertificateService.initOrgCA(orgId, orgName, userId, "Seeded local development CA", {
			seeded_by: "cli",
		});
		console.log("Seeded organization CA");
	}

	const memberCert = await db
		.selectFrom("org_certificates")
		.selectAll()
		.where("org_id", "=", orgId)
		.where("user_id", "=", userId)
		.where("cert_type", "=", "member")
		.where("status", "=", "active")
		.where("is_system_generated", "=", true)
		.executeTakeFirst();

	if (!memberCert) {
		const user = await db
			.selectFrom("users")
			.select(["role_id"])
			.where("id", "=", userId)
			.executeTakeFirstOrThrow();
		const role = await RoleService.getRole(user.role_id);
		await CertificateService.issueMemberCert({
			org_id: orgId,
			target_user_id: userId,
			target_email: email,
			issued_by_user_id: userId,
			envsync_pki_role: CertificateRoleMapper.toPkiRole(role),
			is_system_generated: true,
			persist_private_key: true,
			description: "Seeded local member certificate",
			metadata: {
				role_id: role.id,
				role_name: role.name,
				issued_source: "cli_seed",
				seeded_by: "cli",
			},
		});
		console.log("Seeded member certificate");
		return;
	}

	try {
		const kms = await KMSClient.getInstance();
		const sessionToken = await refreshVaultSession(userId, orgId);
		const session = await kms.validateSession(sessionToken);
		if (!session.scopes.includes("vault:write")) {
			throw new Error(`Seed member session missing vault:write (${session.scopes.join(",")})`);
		}
	} catch {
		invalidateSessionToken(userId, orgId);
		const user = await db
			.selectFrom("users")
			.select(["role_id"])
			.where("id", "=", userId)
			.executeTakeFirstOrThrow();
		const role = await RoleService.getRole(user.role_id);
		await CertificateService.issueMemberCert({
			org_id: orgId,
			target_user_id: userId,
			target_email: email,
			issued_by_user_id: userId,
			envsync_pki_role: CertificateRoleMapper.toPkiRole(role),
			is_system_generated: true,
			persist_private_key: true,
			description: "Refreshed seeded local member certificate",
			metadata: {
				role_id: role.id,
				role_name: role.name,
				issued_source: "cli_seed",
				seeded_by: "cli",
			},
		});
		console.log("Refreshed member certificate");
	}
}

async function ensureSeededApps(orgId: string) {
	const { AppService } = await import("../src/services/app.service");
	const { EnvTypeService } = await import("../src/services/env_type.service");
	const db = await DB.getInstance();

	const appDefinitions = [
		{
			name: "Core Platform",
			description: "Primary API and worker configuration.",
			enable_secrets: true,
			is_managed_secret: false,
			envs: [
				{ name: "Development", color: "#22c55e", is_default: true, is_protected: false },
				{ name: "Staging", color: "#f59e0b", is_default: false, is_protected: true },
				{ name: "Production", color: "#ef4444", is_default: false, is_protected: true },
			],
		},
		{
			name: "Dashboard Web",
			description: "Frontend dashboard configuration and public endpoints.",
			enable_secrets: true,
			is_managed_secret: false,
			envs: [
				{ name: "Development", color: "#06b6d4", is_default: true, is_protected: false },
				{ name: "Preview", color: "#8b5cf6", is_default: false, is_protected: false },
				{ name: "Production", color: "#ec4899", is_default: false, is_protected: true },
			],
		},
	] as const;

	const seededApps: Record<string, { id: string; envs: Record<string, { id: string }> }> = {};

	for (const definition of appDefinitions) {
		const existingApp = await db
			.selectFrom("app")
			.selectAll()
			.where("org_id", "=", orgId)
			.where("name", "=", definition.name)
			.executeTakeFirst();

		const appId =
			existingApp?.id ??
			(
				await AppService.createApp({
					name: definition.name,
					org_id: orgId,
					description: definition.description,
					metadata: { seeded_by: "cli", preset: "local-dev" },
					enable_secrets: definition.enable_secrets,
					is_managed_secret: definition.is_managed_secret,
				})
			).id;
		if (!existingApp) {
			console.log(`Seeded app "${definition.name}"`);
		}

		const envs: Record<string, { id: string }> = {};
		for (const envDefinition of definition.envs) {
			let envType = await db
				.selectFrom("env_type")
				.selectAll()
				.where("org_id", "=", orgId)
				.where("app_id", "=", appId)
				.where("name", "=", envDefinition.name)
				.executeTakeFirst();

			if (!envType) {
				envType = await EnvTypeService.createEnvType({
					name: envDefinition.name,
					org_id: orgId,
					app_id: appId,
					color: envDefinition.color,
					is_default: envDefinition.is_default,
					is_protected: envDefinition.is_protected,
				});
				console.log(`  Seeded env "${envDefinition.name}" for "${definition.name}"`);
			}

			envs[envDefinition.name] = { id: envType.id };
		}

		seededApps[definition.name] = { id: appId, envs };
	}

	return seededApps;
}

async function ensureSeededSecrets(
	orgId: string,
	userId: string,
	apps: Record<string, { id: string; envs: Record<string, { id: string }> }>,
) {
	const { SecretService } = await import("../src/services/secret.service");
	const { SecretStorePiTService } = await import("../src/services/secret_store_pit.service");

	const secretDefinitions = [
		{
			appName: "Core Platform",
			envName: "Development",
			key: "DATABASE_URL",
			value: "postgres://envsync:envsync@localhost:5432/envsync_dev",
		},
		{
			appName: "Core Platform",
			envName: "Development",
			key: "REDIS_URL",
			value: "redis://localhost:6379",
		},
		{
			appName: "Core Platform",
			envName: "Staging",
			key: "JWT_SECRET",
			value: "envsync-staging-jwt-secret",
		},
		{
			appName: "Dashboard Web",
			envName: "Development",
			key: "VITE_API_BASE_URL",
			value: "http://api.lvh.me:4000",
		},
		{
			appName: "Dashboard Web",
			envName: "Production",
			key: "VITE_AUTH_BASE_URL",
			value: "https://auth.example.com",
		},
	] as const;

	for (const definition of secretDefinitions) {
		const app = apps[definition.appName];
		const envType = app?.envs[definition.envName];
		if (!app || !envType) {
			continue;
		}

		const existing = await SecretService.getSecret({
			key: definition.key,
			env_type_id: envType.id,
			app_id: app.id,
			org_id: orgId,
			user_id: userId,
		});

		if (!existing) {
			await SecretService.createSecret(
				{
					key: definition.key,
					value: definition.value,
					env_type_id: envType.id,
					app_id: app.id,
					org_id: orgId,
					user_id: userId,
				},
				{ allowProtected: true },
			);
			await SecretStorePiTService.createSecretStorePiT({
				org_id: orgId,
				app_id: app.id,
				env_type_id: envType.id,
				change_request_message: `Seeded local development secret ${definition.key}`,
				user_id: userId,
				envs: [
					{
						key: definition.key,
						value: definition.value,
						operation: "CREATE",
					},
				],
			});
			console.log(`Seeded secret ${definition.key} in ${definition.appName}/${definition.envName}`);
			continue;
		}

		const history = await SecretStorePiTService.getSecretStorePiTsByVariable({
			org_id: orgId,
			app_id: app.id,
			env_type_id: envType.id,
			key: definition.key,
		});

		if (history.length === 0) {
			await SecretStorePiTService.createSecretStorePiT({
				org_id: orgId,
				app_id: app.id,
				env_type_id: envType.id,
				change_request_message: `Backfilled seeded local development secret ${definition.key}`,
				user_id: userId,
				envs: [
					{
						key: definition.key,
						value: existing.value,
						operation: "CREATE",
					},
				],
			});
			console.log(
				`Backfilled PiT for seeded secret ${definition.key} in ${definition.appName}/${definition.envName}`,
			);
		}
	}
}

async function ensureSeededTeam(orgId: string, userId: string) {
	const { TeamService } = await import("../src/services/team.service");
	const db = await DB.getInstance();

	const existingTeam = await db
		.selectFrom("teams")
		.selectAll()
		.where("org_id", "=", orgId)
		.where("name", "=", "Platform")
		.executeTakeFirst();

	const teamId =
		existingTeam?.id ??
		(
			(await TeamService.createTeam({
				name: "Platform",
				org_id: orgId,
				description: "Seeded platform team for local development.",
				color: "#0f766e",
			})) as { id: string }
		).id;
	if (!existingTeam) {
		console.log('Seeded team "Platform"');
	}

	const member = await db
		.selectFrom("team_members")
		.selectAll()
		.where("team_id", "=", teamId)
		.where("user_id", "=", userId)
		.executeTakeFirst();

	if (!member) {
		await TeamService.addTeamMember(teamId, userId);
		console.log('Added dev user to team "Platform"');
	}
}

async function ensureSeededApiKey(orgId: string, userId: string) {
	const { ApiKeyService } = await import("../src/services/api_key.service");
	const db = await DB.getInstance();

	const existing = await db
		.selectFrom("api_keys")
		.selectAll()
		.where("org_id", "=", orgId)
		.where("user_id", "=", userId)
		.where("description", "=", "Seeded local development key")
		.executeTakeFirst();

	if (!existing) {
		await ApiKeyService.createKey({
			org_id: orgId,
			user_id: userId,
			description: "Seeded local development key",
		});
		console.log("Seeded API key");
	}
}

async function ensureSeededWebhook(orgId: string, userId: string, appId?: string) {
	const { WebhookService } = await import("../src/services/webhook.service");
	const db = await DB.getInstance();

	const existing = await db
		.selectFrom("webhook_store")
		.selectAll()
		.where("org_id", "=", orgId)
		.where("name", "=", "Local Debug Webhook")
		.executeTakeFirst();

	if (!existing) {
		await WebhookService.createWebhook({
			name: "Local Debug Webhook",
			org_id: orgId,
			user_id: userId,
			url: "http://localhost:8025/api/v1/messages",
			webhook_type: "CUSTOM",
			linked_to: appId ? "app" : "org",
			app_id: appId,
			event_types: ["app_created", "secret_created", "cert_member_issued", "webhook_triggered"],
		});
		console.log("Seeded webhook");
	}
}

async function verifySeededVaultRoundTrip(
	orgId: string,
	userId: string,
	appId: string,
	envTypeId: string,
) {
	const { EnvService } = await import("../src/services/env.service");

	const key = `__seed_vault_probe_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
	const value = `seed-probe-${Date.now()}`;

	await EnvService.createEnv(
		{
			key,
			value,
			env_type_id: envTypeId,
			app_id: appId,
			org_id: orgId,
			user_id: userId,
		},
		{ allowProtected: true },
	);

	try {
		const roundTrip = await EnvService.getEnv({
			key,
			env_type_id: envTypeId,
			app_id: appId,
			org_id: orgId,
			user_id: userId,
		});

		if (!roundTrip || roundTrip.value !== value) {
			throw new Error(
				`Seed vault round-trip returned ${roundTrip ? "unexpected value" : "no value"}`,
			);
		}
	} finally {
		await EnvService.deleteEnv(
			{
				key,
				app_id: appId,
				env_type_id: envTypeId,
				org_id: orgId,
				user_id: userId,
			},
			{ allowProtected: true },
		).catch(() => {});
	}
}

async function ensureSeededVaultAccess(
	orgId: string,
	orgName: string,
	userId: string,
	email: string,
	apps: Record<string, { id: string; envs: Record<string, { id: string }> }>,
) {
	const probeApp = apps["Core Platform"] ?? Object.values(apps)[0];
	const probeEnv = probeApp?.envs["Development"] ?? Object.values(probeApp?.envs ?? {})[0];

	if (!probeApp || !probeEnv) {
		return;
	}

	try {
		await verifySeededVaultRoundTrip(orgId, userId, probeApp.id, probeEnv.id);
	} catch (error) {
		console.warn(
			`Seed vault round-trip failed for org ${orgId}. Refreshing local certificate state.`,
			error instanceof Error ? error.message : error,
		);
		await repairSeededOrgCertificates(orgId);
		await ensureOrgCertificates(orgId, orgName, userId, email);
		await refreshVaultSession(userId, orgId);
		try {
			await verifySeededVaultRoundTrip(orgId, userId, probeApp.id, probeEnv.id);
		} catch (repairError) {
			throw new Error(
				`Seed vault access still invalid after certificate/session repair (org=${orgId}, user=${userId}, app=${probeApp.id}, envType=${probeEnv.id}): ${
					repairError instanceof Error ? repairError.message : String(repairError)
				}`,
			);
		}
		console.log("Seeded vault access repaired");
	}
}

async function seedDevWorkspace(orgId: string, orgName: string, userId: string, email: string) {
	await ensureOrgCertificates(orgId, orgName, userId, email);
	const apps = await ensureSeededApps(orgId);
	await ensureSeededVaultAccess(orgId, orgName, userId, email, apps);
	await ensureSeededSecrets(orgId, userId, apps);
	await ensureSeededTeam(orgId, userId);
	await ensureSeededApiKey(orgId, userId);
	await ensureSeededWebhook(orgId, userId, apps["Core Platform"]?.id);
}

type HarnessIdentity = {
	email: string;
	fullName: string;
	roleName: string;
	seedWorkspace?: boolean;
};

const UI_HARNESS_IDENTITIES: HarnessIdentity[] = [
	{
		email: "dev@envsync.local",
		fullName: "EnvSync Dev",
		roleName: "master",
		seedWorkspace: true,
	},
	{
		email: "admin-ui@envsync.local",
		fullName: "EnvSync Admin",
		roleName: "admin",
	},
	{
		email: "editor-ui@envsync.local",
		fullName: "EnvSync Editor",
		roleName: "editor",
	},
	{
		email: "viewer-ui@envsync.local",
		fullName: "EnvSync Viewer",
		roleName: "viewer",
	},
];

async function ensureUiHarnessMembership(
	org: { id: string; name: string; slug: string },
	role: { id: string; name: string; is_master: boolean },
	identity: HarnessIdentity,
) {
	const db = await DB.getInstance();
	const { UserService } = await import("../src/services/user.service");
	const password = DEV_USER_PASSWORD;
	const parts = identity.fullName.trim().split(/\s+/).filter(Boolean);

	let idpUser = await findKeycloakUserByUsername(identity.email);
	if (!idpUser) {
		idpUser = await createKeycloakUser({
			userName: identity.email,
			email: identity.email,
			firstName: parts[0] ?? "EnvSync",
			lastName: parts.slice(1).join(" ") || "User",
			password,
		});
		console.log(`Created Keycloak user for ${identity.email}`);
	} else {
		await setKeycloakUserPassword(idpUser.id, password);
	}

	const memberships = await UserService.listUsersByIdpId(idpUser.id);
	let targetMembership = memberships.find(user => user.org_id === org.id) ?? null;

	if (!targetMembership) {
		const legacyTargetMembership = await db
			.selectFrom("users")
			.selectAll()
			.where("org_id", "=", org.id)
			.where("email", "=", identity.email)
			.executeTakeFirst();

		if (legacyTargetMembership) {
			await db
				.updateTable("users")
				.set({
					auth_service_id: idpUser.id,
					role_id: role.id,
					full_name: identity.fullName,
					is_active: true,
					updated_at: new Date(),
				})
				.where("id", "=", legacyTargetMembership.id)
				.execute();
			targetMembership = await db
				.selectFrom("users")
				.selectAll()
				.where("id", "=", legacyTargetMembership.id)
				.executeTakeFirstOrThrow();
			console.log(`Recovered local membership for ${identity.email} in org ${org.slug}`);
		} else {
			const created = await UserService.createMembershipForExistingIdentity({
				email: identity.email,
				full_name: identity.fullName,
				auth_service_id: idpUser.id,
				org_id: org.id,
				role_id: role.id,
				is_active: true,
			});
			targetMembership = await db
				.selectFrom("users")
				.selectAll()
				.where("id", "=", created.id)
				.executeTakeFirstOrThrow();
			console.log(`Created ${identity.roleName} membership for ${identity.email} in org ${org.slug}`);
		}
	}

	if (targetMembership.auth_service_id !== idpUser.id) {
		await db
			.updateTable("users")
			.set({
				auth_service_id: idpUser.id,
				updated_at: new Date(),
			})
			.where("id", "=", targetMembership.id)
			.execute();
	}

	if (targetMembership.full_name !== identity.fullName) {
		await db
			.updateTable("users")
			.set({
				full_name: identity.fullName,
				updated_at: new Date(),
			})
			.where("id", "=", targetMembership.id)
			.execute();
	}

	if (!targetMembership.is_active) {
		await db
			.updateTable("users")
			.set({
				is_active: true,
				updated_at: new Date(),
			})
			.where("id", "=", targetMembership.id)
			.execute();
	}

	if (targetMembership.role_id !== role.id) {
		await UserService.updateUser(targetMembership.id, { role_id: role.id });
	}

	await ensureUserRoleAccess(targetMembership.id, org.id, role.id);
	await UserService.touchLastLogin(targetMembership.id);

	const refreshedMembership = await db
		.selectFrom("users")
		.selectAll()
		.where("id", "=", targetMembership.id)
		.executeTakeFirstOrThrow();

	if (identity.seedWorkspace) {
		await seedDevWorkspace(org.id, org.name, refreshedMembership.id, identity.email);
	}

	return refreshedMembership;
}

async function ensureUiHarnessPlan(orgId: string) {
	const { EditionPolicyService } = await import("../src/services/edition-policy.service");
	if (!EditionPolicyService.isHosted()) return;
	const { OrgFeatureGrantService } = await import("../src/services/org-feature-grant.service");
	const grant = await OrgFeatureGrantService.replaceGrant({
		orgId,
		plan: "enterprise",
		source: "seed",
		updatedBy: "ui-harness",
	});
	console.log(`UI harness plan=${grant.plan} org=${orgId}`);
}

async function bootstrapUiHarness() {
	const rawArgs = process.argv.slice(3);
	const orgName = getFlagValue(rawArgs, "org-name") ?? `EnvSync UI ${Date.now()}`;
	const orgSlug = getFlagValue(rawArgs, "org-slug") ?? `envsync-ui-${Date.now()}`;
	const db = await DB.getInstance();

	const org = await ensureDevOrg(orgName, orgSlug, {
		email: UI_HARNESS_IDENTITIES[0]!.email,
		full_name: UI_HARNESS_IDENTITIES[0]!.fullName,
		password: DEV_USER_PASSWORD,
	});
	await ensureUiHarnessPlan(org.id);
	const roles = await ensureDefaultRoles(org.id);

	for (const identity of UI_HARNESS_IDENTITIES) {
		const role = resolveRequestedRole(
			roles.map(entry => ({ id: entry.id, name: entry.name, is_master: Boolean(entry.is_master) })),
			identity.roleName,
		);
		if (!role) {
			throw new Error(`Requested role "${identity.roleName}" does not exist in org ${org.id}`);
		}

		await ensureUiHarnessMembership(org, role, identity);
	}

	await ensureOrgResourceAccess(org.id);

	const summary = await Promise.all(
		UI_HARNESS_IDENTITIES.map(async identity => {
			const keycloakUser = await findKeycloakUserByUsername(identity.email);
			if (!keycloakUser) {
				return `${identity.email}: missing`;
			}
			const { UserService } = await import("../src/services/user.service");
			const membership = (await UserService.listUsersByIdpId(keycloakUser.id)).find(user => user.org_id === org.id);
			return `${identity.email}: ${membership?.id ?? "missing"} (${identity.roleName})`;
		}),
	);

	console.log(`UI harness bootstrapped for org ${org.slug}`);
	for (const line of summary) {
		console.log(`  ${line}`);
	}
}

async function createDevUser() {
	const rawArgs = process.argv.slice(3);
	const positional = rawArgs.filter((arg, index) => {
		if (!arg.startsWith("--")) {
			return index === 0 || rawArgs[index - 1] !== "--role";
		}
		return false;
	});
	const flags = new Set(rawArgs.filter(arg => arg.startsWith("--")));
	const requestedRole = getFlagValue(rawArgs, "role");
	const requestedOrgName = getFlagValue(rawArgs, "org-name") ?? DEV_ORG_NAME;
	const requestedOrgSlug = getFlagValue(rawArgs, "org-slug") ?? DEV_ORG_SLUG;
	const email = positional[0] ?? "dev@envsync.local";
	const fullName = positional[1] ?? "EnvSync Dev";
	const password = DEV_USER_PASSWORD;
	const db = await DB.getInstance();

	let org = await ensureDevOrg(requestedOrgName, requestedOrgSlug, {
		email,
		full_name: fullName,
		password,
	});
	let roles = await ensureDefaultRoles(org.id);
	let role = resolveRequestedRole(
		roles.map(entry => ({ id: entry.id, name: entry.name, is_master: Boolean(entry.is_master) })),
		requestedRole,
	);
	if (!role) {
		throw new Error(
			`Requested role "${requestedRole ?? "master"}" does not exist in org ${org.id}`,
		);
	}

	let user = await db.selectFrom("users").selectAll().where("email", "=", email).executeTakeFirst();

	if (!user) {
		const parts = fullName.trim().split(/\s+/).filter(Boolean);
		const existingIdpUser = await findKeycloakUserByUsername(email);
		const idp =
			existingIdpUser ??
			(await createKeycloakUser({
				userName: email,
				email,
				firstName: parts[0] ?? "EnvSync",
				lastName: parts.slice(1).join(" ") || "Dev",
				password,
			}));
		if (existingIdpUser) {
			await setKeycloakUserPassword(existingIdpUser.id, password);
			console.log("Recovered existing Keycloak-only dev user into local database");
		}

		const userId = randomUUID();
		await db
			.insertInto("users")
			.values({
				id: userId,
				email,
				org_id: org.id,
				role_id: role.id,
				auth_service_id: idp.id,
				full_name: fullName,
				is_active: true,
				profile_picture_url: null,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();
		user = await db
			.selectFrom("users")
			.selectAll()
			.where("id", "=", userId)
			.executeTakeFirstOrThrow();
		console.log(`Dev user created: ${email} / ${password}`);
	} else {
		console.log(`Dev user already exists: ${email}`);

		let idpUser = user.auth_service_id ? await getKeycloakUserById(user.auth_service_id) : null;
		if (!idpUser) {
			idpUser = await findKeycloakUserByUsername(email);
		}
		if (!idpUser) {
			const parts = fullName.trim().split(/\s+/).filter(Boolean);
			idpUser = await createKeycloakUser({
				userName: email,
				email,
				firstName: parts[0] ?? "EnvSync",
				lastName: parts.slice(1).join(" ") || "Dev",
				password,
			});
			console.log("Recreated missing Keycloak user for existing dev account");
		}
		if (user.auth_service_id !== idpUser.id) {
			await db
				.updateTable("users")
				.set({ auth_service_id: idpUser.id, updated_at: new Date() })
				.where("id", "=", user.id)
				.execute();
			user = await db
				.selectFrom("users")
				.selectAll()
				.where("id", "=", user.id)
				.executeTakeFirstOrThrow();
			console.log("Synced dev user auth_service_id with Keycloak");
		}
		await setKeycloakUserPassword(idpUser.id, password);
		console.log(`Dev user login reset: ${email} / ${password}`);
		if (user.org_id !== org.id) {
			await moveUserToOrg(user.id, org.id, role.id, user.org_id);
			user = await db
				.selectFrom("users")
				.selectAll()
				.where("id", "=", user.id)
				.executeTakeFirstOrThrow();
			console.log(`Moved dev user into org ${org.slug}`);
		}
		if (user.role_id !== role.id) {
			const { UserService } = await import("../src/services/user.service");
			await UserService.updateUser(user.id, { role_id: role.id });
			user = await db
				.selectFrom("users")
				.selectAll()
				.where("id", "=", user.id)
				.executeTakeFirstOrThrow();
			console.log(`Updated dev user role to ${role.name}`);
		}
	}

	await ensureUserRoleAccess(user.id, org.id, role.id);
	console.log("Dev user permissions synced");

	if (flags.has("--seed")) {
		try {
			await seedDevWorkspace(org.id, org.name, user.id, email);
		} catch (error) {
			if (!isSeededVaultRepairFailure(error) || requestedOrgSlug !== DEV_ORG_SLUG) {
				throw error;
			}

			const recoveryOrgSlug = buildRecoveryOrgSlug(requestedOrgSlug);
			console.warn(
				`Local vault state for org ${requestedOrgSlug} remains invalid after repair. Creating replacement org ${recoveryOrgSlug}.`,
			);
			org = await ensureDevOrg(requestedOrgName, recoveryOrgSlug, {
				email,
				full_name: fullName,
				password,
			});
			roles = await ensureDefaultRoles(org.id);
			role = resolveRequestedRole(
				roles.map(entry => ({
					id: entry.id,
					name: entry.name,
					is_master: Boolean(entry.is_master),
				})),
				requestedRole,
			);
			if (!role) {
				throw new Error(
					`Requested role "${requestedRole ?? "master"}" does not exist in recovery org ${org.id}`,
				);
			}
			await moveUserToOrg(user.id, org.id, role.id, user.org_id);
			user = await db
				.selectFrom("users")
				.selectAll()
				.where("id", "=", user.id)
				.executeTakeFirstOrThrow();
			console.log(`Moved dev user into recovery org ${org.slug}`);
			await ensureUserRoleAccess(user.id, org.id, role.id);
			console.log("Dev user permissions synced in recovery org");
			await seedDevWorkspace(org.id, org.name, user.id, email);
		}
		console.log("Seeded local development workspace");
	}

	await ensureOrgResourceAccess(org.id);
}

function getFeaturesFlag(rawArgs: string[]): string | undefined {
	const inlinePrefix = "--features=";
	for (const arg of rawArgs) {
		if (arg.startsWith(inlinePrefix)) {
			return arg.slice(inlinePrefix.length);
		}
	}
	const index = rawArgs.indexOf("--features");
	if (index === -1) {
		return undefined;
	}
	const next = rawArgs[index + 1];
	if (next === undefined || next.startsWith("--")) {
		return "";
	}
	return next;
}

async function grantOrgFeatures() {
	const rawArgs = process.argv.slice(3);
	const orgSlug = getFlagValue(rawArgs, "org-slug");
	if (!orgSlug) {
		throw new Error("--org-slug is required");
	}

	const db = await DB.getInstance();
	const org = await db.selectFrom("orgs").selectAll().where("slug", "=", orgSlug).executeTakeFirst();
	if (!org) {
		throw new Error(`Organization not found for slug ${orgSlug}`);
	}

	const { OrgFeatureGrantService } = await import("../src/services/org-feature-grant.service");
	const clear = rawArgs.includes("--clear");
	if (clear) {
		await OrgFeatureGrantService.deleteGrant(org.id);
		console.log(`Cleared org feature grant for ${org.slug} (${org.id}); unrestricted`);
		return;
	}

	const rawFeatures = getFeaturesFlag(rawArgs);
	if (rawFeatures === undefined) {
		throw new Error("--features is required unless --clear is set");
	}
	const features = rawFeatures
		.split(",")
		.map(value => value.trim())
		.filter(Boolean);
	const source = getFlagValue(rawArgs, "source") ?? "seed";
	const planFlag = getFlagValue(rawArgs, "plan");
	const grant = await OrgFeatureGrantService.replaceGrant({
		orgId: org.id,
		features,
		plan: planFlag === "developer" || planFlag === "plus" || planFlag === "enterprise" ? planFlag : undefined,
		source,
		updatedBy: "cli",
	});
	console.log(
		`Set org feature grant for ${org.slug} (${org.id}): plan=${grant.plan} [${grant.features.join(", ")}] source=${grant.source}`,
	);
}

async function setOrgPlan() {
	const rawArgs = process.argv.slice(3);
	const orgSlug = getFlagValue(rawArgs, "org-slug");
	const plan = getFlagValue(rawArgs, "plan");
	if (!orgSlug || !plan) {
		throw new Error("--org-slug and --plan are required");
	}
	if (plan !== "developer" && plan !== "plus" && plan !== "enterprise") {
		throw new Error("--plan must be developer, plus, or enterprise");
	}
	const db = await DB.getInstance();
	const org = await db.selectFrom("orgs").selectAll().where("slug", "=", orgSlug).executeTakeFirst();
	if (!org) {
		throw new Error(`Organization not found for slug ${orgSlug}`);
	}
	const { OrgFeatureGrantService } = await import("../src/services/org-feature-grant.service");
	const grant = await OrgFeatureGrantService.replaceGrant({
		orgId: org.id,
		plan,
		source: getFlagValue(rawArgs, "source") ?? "support",
		updatedBy: "cli",
	});
	console.log(`Set plan for ${org.slug} (${org.id}): ${grant.plan} features=[${grant.features.join(", ")}]`);
}

async function backfillHostedPlans() {
	const rawArgs = process.argv.slice(3);
	const plan = getFlagValue(rawArgs, "plan") ?? "enterprise";
	if (plan !== "developer" && plan !== "plus" && plan !== "enterprise") {
		throw new Error("--plan must be developer, plus, or enterprise");
	}
	const dryRun = rawArgs.includes("--dry-run");
	const db = await DB.getInstance();
	const orgs = await db.selectFrom("orgs").select(["id", "slug"]).execute();
	const { OrgFeatureGrantService } = await import("../src/services/org-feature-grant.service");
	let written = 0;
	for (const org of orgs) {
		const existing = await OrgFeatureGrantService.getGrant(org.id);
		if (existing) {
			console.log(`skip ${org.slug} already plan=${existing.plan}`);
			continue;
		}
		if (dryRun) {
			console.log(`would set ${org.slug} → ${plan}`);
			written += 1;
			continue;
		}
		await OrgFeatureGrantService.replaceGrant({
			orgId: org.id,
			plan,
			source: "backfill",
			updatedBy: "cli",
		});
		console.log(`set ${org.slug} → ${plan}`);
		written += 1;
	}
	console.log(`backfill ${dryRun ? "dry-run " : ""}complete: ${written}/${orgs.length} orgs`);
}

const cmd = process.argv[2];
if (cmd === "init") {
	await init();
} else if (cmd === "create-dev-user") {
	await createDevUser();
} else if (cmd === "bootstrap-ui-harness") {
	await bootstrapUiHarness();
} else if (cmd === "grant-org-features") {
	await grantOrgFeatures();
} else if (cmd === "set-plan") {
	await setOrgPlan();
} else if (cmd === "backfill-hosted-plans") {
	await backfillHostedPlans();
} else if (cmd === "bootstrap-org") {
	const rawArgs = process.argv.slice(3);
	const orgName = getFlagValue(rawArgs, "org-name") ?? DEV_ORG_NAME;
	const orgSlug = getFlagValue(rawArgs, "org-slug") ?? DEV_ORG_SLUG;
	const email = getFlagValue(rawArgs, "email") ?? "admin@envsync.local";
	const fullName = getFlagValue(rawArgs, "full-name") ?? "EnvSync Admin";
	const password = getFlagValue(rawArgs, "password") ?? DEV_USER_PASSWORD;
	const org = await ensureDevOrg(orgName, orgSlug, {
		email,
		full_name: fullName,
		password,
	});
	console.log(`Bootstrap completed for org ${org.slug} (${org.id})`);
} else {
	console.log(
		"Usage: bun run scripts/cli.ts <init|create-dev-user|bootstrap-ui-harness|bootstrap-org|grant-org-features|set-plan|backfill-hosted-plans>",
	);
	process.exit(cmd ? 1 : 0);
}

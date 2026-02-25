/**
 * Auth helpers for E2E tests.
 *
 * Uses the same DB seed helpers as mock tests, plus real FGA/Vault clients.
 * Tokens are real JWTs issued by the real Zitadel instance.
 */
import { v4 as uuidv4 } from "uuid";

import { DB } from "@/libs/db";
import { KMSClient } from "@/libs/kms/client";
import { FGAClient } from "@/libs/openfga/index";
import { VaultClient } from "@/libs/vault/index";

import { createZitadelTestUser, getZitadelAccessToken } from "./zitadel-bootstrap";

export interface E2EUser {
	id: string;
	token: string;
	email: string;
	authServiceId: string;
}

export interface E2EOrg {
	id: string;
	name: string;
	slug: string;
}

export interface E2ESeed {
	org: E2EOrg;
	masterUser: E2EUser;
	roles: Record<string, { id: string; name: string }>;
}

// ── Zitadel credentials (cached from env) ───────────────────────────

let zitadelCreds: {
	url: string;
	pat: string;
	loginPat: string;
	clientId: string;
	clientSecret: string;
} | null = null;

function initZitadelCredentials(): typeof zitadelCreds & {} {
	if (zitadelCreds) return zitadelCreds;

	const url = process.env.ZITADEL_URL;
	const pat = process.env.ZITADEL_PAT;
	const loginPat = process.env.ZITADEL_LOGIN_PAT || pat;
	const clientId = process.env.ZITADEL_E2E_CLIENT_ID;
	const clientSecret = process.env.ZITADEL_E2E_CLIENT_SECRET;

	if (!url || !pat || !loginPat || !clientId || !clientSecret) {
		throw new Error(
			"Missing Zitadel E2E credentials. Ensure ZITADEL_URL, ZITADEL_PAT, " +
			"ZITADEL_E2E_CLIENT_ID, and ZITADEL_E2E_CLIENT_SECRET are set. " +
			"Run 'bun run e2e:init' first.",
		);
	}

	zitadelCreds = { url, pat, loginPat, clientId, clientSecret };
	return zitadelCreds;
}

// ── Seed helpers ────────────────────────────────────────────────────

/**
 * Create a test org with default roles and a master user.
 * Uses the real database and writes real FGA tuples.
 */
export async function seedE2EOrg(): Promise<E2ESeed> {
	const db = await DB.getInstance();
	const orgId = uuidv4();
	const slug = `e2e-${orgId.slice(0, 8)}`;

	// Create org
	await db
		.insertInto("orgs")
		.values({
			id: orgId,
			name: `E2E Test Org ${slug}`,
			slug,
			metadata: {},
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

	// Create default roles (table is "org_role", matching mock helper db.ts)
	const DEFAULT_ROLES = [
		{
			key: "master",
			name: "Org Admin",
			is_master: true,
			is_admin: true,
			can_view: true,
			can_edit: true,
			have_api_access: true,
			have_billing_options: true,
			have_webhook_access: true,
			have_gpg_access: true,
			have_cert_access: true,
			have_audit_access: true,
			color: "#FF5733",
		},
		{
			key: "admin",
			name: "Billing Admin",
			is_admin: false,
			is_master: false,
			can_view: false,
			can_edit: false,
			have_api_access: false,
			have_billing_options: true,
			have_webhook_access: false,
			have_gpg_access: false,
			have_cert_access: false,
			have_audit_access: false,
			color: "#33FF57",
		},
		{
			key: "developer",
			name: "Developer",
			is_admin: false,
			is_master: false,
			can_view: true,
			can_edit: true,
			have_api_access: false,
			have_billing_options: false,
			have_webhook_access: false,
			have_gpg_access: false,
			have_cert_access: false,
			have_audit_access: false,
			color: "#572F13",
		},
		{
			key: "viewer",
			name: "Viewer",
			is_admin: false,
			is_master: false,
			can_view: true,
			can_edit: false,
			have_api_access: false,
			have_billing_options: false,
			have_webhook_access: false,
			have_gpg_access: false,
			have_cert_access: false,
			have_audit_access: false,
			color: "#FF33A1",
		},
	] as const;

	const roles: Record<string, { id: string; name: string }> = {};
	for (const roleDef of DEFAULT_ROLES) {
		const id = uuidv4();
		const { key, ...values } = roleDef;
		await db
			.insertInto("org_role")
			.values({
				id,
				...values,
				org_id: orgId,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();
		roles[key] = { id, name: roleDef.name };
	}

	// Create master user
	const masterUser = await seedE2EUser(orgId, roles.master.id);

	// Write FGA tuples for master user with full permissions
	const fga = await FGAClient.getInstance();
	const userRef = `user:${masterUser.id}`;
	const orgRef = `org:${orgId}`;

	await fga.writeTuples([
		{ user: userRef, relation: "member", object: orgRef },
		{ user: userRef, relation: "master", object: orgRef },
		{ user: userRef, relation: "admin", object: orgRef },
		{ user: userRef, relation: "can_view", object: orgRef },
		{ user: userRef, relation: "can_edit", object: orgRef },
		{ user: userRef, relation: "have_api_access", object: orgRef },
	]);
	await fga.writeTuples([
		{ user: userRef, relation: "have_billing_options", object: orgRef },
		{ user: userRef, relation: "have_webhook_access", object: orgRef },
	]);

	return { org: { id: orgId, name: `E2E Test Org ${slug}`, slug }, masterUser, roles };
}

/**
 * Create a test user in an org with a given role.
 * Creates a real user in Zitadel and obtains a real JWT.
 */
export async function seedE2EUser(
	orgId: string,
	roleId: string,
): Promise<E2EUser> {
	const creds = initZitadelCredentials();
	const db = await DB.getInstance();
	const id = uuidv4();
	const email = `e2e-${id.slice(0, 8)}@test.local`;
	const password = "E2eTest1!strong";

	// 1. Create user in Zitadel
	const zitadelUser = await createZitadelTestUser(creds.url, creds.pat, {
		email,
		firstName: "E2E",
		lastName: `User ${id.slice(0, 8)}`,
		password,
	});

	// 2. Insert user in DB with auth_service_id = Zitadel user ID
	await db
		.insertInto("users")
		.values({
			id,
			email,
			full_name: `E2E User ${id.slice(0, 8)}`,
			auth_service_id: zitadelUser.zitadelUserId,
			org_id: orgId,
			role_id: roleId,
			is_active: true,
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

	// 3. Get real JWT access token from Zitadel
	const token = await getZitadelAccessToken(
		creds.url,
		creds.clientId,
		creds.clientSecret,
		creds.loginPat,
		email,
		password,
	);

	return {
		id,
		token,
		email,
		authServiceId: zitadelUser.zitadelUserId,
	};
}

/**
 * Convenience: write FGA tuples for a user based on role flags.
 */
export async function setupE2EUserPermissions(
	userId: string,
	orgId: string,
	flags: {
		is_master?: boolean;
		is_admin?: boolean;
		can_view?: boolean;
		can_edit?: boolean;
		have_api_access?: boolean;
		have_billing_options?: boolean;
		have_webhook_access?: boolean;
	},
): Promise<void> {
	const fga = await FGAClient.getInstance();
	const user = `user:${userId}`;
	const org = `org:${orgId}`;

	const tuples: { user: string; relation: string; object: string }[] = [
		{ user, relation: "member", object: org },
	];

	if (flags.is_master) tuples.push({ user, relation: "master", object: org });
	if (flags.is_admin) tuples.push({ user, relation: "admin", object: org });
	if (flags.can_view) tuples.push({ user, relation: "can_view", object: org });
	if (flags.can_edit) tuples.push({ user, relation: "can_edit", object: org });
	if (flags.have_api_access) tuples.push({ user, relation: "have_api_access", object: org });
	if (flags.have_billing_options) tuples.push({ user, relation: "have_billing_options", object: org });
	if (flags.have_webhook_access) tuples.push({ user, relation: "have_webhook_access", object: org });

	// FGA limits to 10 tuples per write
	for (let i = 0; i < tuples.length; i += 10) {
		await fga.writeTuples(tuples.slice(i, i + 10));
	}
}

/**
 * Check service health before running E2E tests.
 * Throws if any required service is unreachable.
 */
export async function checkServiceHealth(): Promise<void> {
	const checks = [
		{
			name: "PostgreSQL",
			check: async () => {
				const db = await DB.getInstance();
				await db.selectFrom("orgs").select("id").limit(1).execute();
			},
		},
		{
			name: "OpenFGA",
			check: async () => {
				const fga = await FGAClient.getInstance();
				await fga.healthCheck();
			},
		},
		{
			name: "Vault",
			check: async () => {
				const vault = await VaultClient.getInstance();
				await vault.healthCheck();
			},
		},
		{
			name: "Zitadel",
			check: async () => {
				const url = (process.env.ZITADEL_URL ?? "http://localhost:8080").replace(/\/$/, "");
				const res = await fetch(`${url}/.well-known/openid-configuration`, {
					signal: AbortSignal.timeout(5000),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
			},
		},
		{
			name: "miniKMS",
			check: async () => {
				const kms = await KMSClient.getInstance();
				const healthy = await kms.healthCheck();
				if (!healthy) throw new Error("miniKMS health check returned non-SERVING status");
			},
		},
	];

	for (const { name, check } of checks) {
		try {
			await check();
		} catch (err) {
			throw new Error(
				`E2E prerequisite failed: ${name} is not reachable. ` +
					`Ensure docker-compose services are running. ` +
					`Error: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}

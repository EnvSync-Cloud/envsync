/**
 * Auth helpers for E2E tests.
 *
 * Uses SpacetimeDB for data seeding and Keycloak for real user management
 * and JWT token issuance.
 */
import { v4 as uuidv4 } from "uuid";

import { STDBClient } from "@/libs/stdb";

import { createKeycloakTestUser, getKeycloakAccessToken } from "./keycloak-bootstrap";

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

// ── Keycloak credentials (cached from env) ───────────────────────────

let keycloakCreds: {
	url: string;
	realm: string;
	adminUser: string;
	adminPassword: string;
	clientId: string;
	clientSecret: string;
} | null = null;

function initKeycloakCredentials(): typeof keycloakCreds & {} {
	if (keycloakCreds) return keycloakCreds;

	const url = process.env.KEYCLOAK_URL;
	const realm = process.env.KEYCLOAK_REALM ?? "envsync";
	const adminUser = process.env.KEYCLOAK_ADMIN_USER;
	const adminPassword = process.env.KEYCLOAK_ADMIN_PASSWORD;
	const clientId = process.env.KEYCLOAK_E2E_CLIENT_ID ?? process.env.KEYCLOAK_API_CLIENT_ID;
	const clientSecret = process.env.KEYCLOAK_E2E_CLIENT_SECRET ?? process.env.KEYCLOAK_API_CLIENT_SECRET;

	if (!url || !adminUser || !adminPassword || !clientId || !clientSecret) {
		throw new Error(
			"Missing Keycloak E2E credentials. Ensure KEYCLOAK_URL, KEYCLOAK_ADMIN_USER, " +
			"KEYCLOAK_ADMIN_PASSWORD, and KEYCLOAK_API_CLIENT_ID/SECRET are set. " +
			"Run 'bun run e2e:init' first.",
		);
	}

	keycloakCreds = { url, realm, adminUser, adminPassword, clientId, clientSecret };
	return keycloakCreds;
}

// ── Seed helpers ────────────────────────────────────────────────────

/**
 * Create a test org with default roles and a master user.
 * Uses the real SpacetimeDB instance and writes auth tuples via STDB reducers.
 */
export async function seedE2EOrg(): Promise<E2ESeed> {
	const stdb = STDBClient.getInstance();
	const orgId = uuidv4();
	const slug = `e2e-${orgId.slice(0, 8)}`;

	// Create org
	await stdb.callReducer("create_org", [orgId, `E2E Test Org ${slug}`, slug, {}]);

	// Create default roles
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
		await stdb.callReducer("create_org_role", [
			id,
			orgId,
			roleDef.name,
			roleDef.can_edit,
			roleDef.can_view,
			roleDef.have_api_access,
			roleDef.have_billing_options,
			roleDef.have_webhook_access,
			roleDef.have_gpg_access,
			roleDef.have_cert_access,
			roleDef.have_audit_access,
			roleDef.is_admin,
			roleDef.is_master,
			roleDef.color,
		]);
		roles[roleDef.key] = { id, name: roleDef.name };
	}

	// Create master user
	const masterUser = await seedE2EUser(orgId, roles.master.id);

	// Write auth tuples via STDB reducers for master user with full permissions
	const userRef = `user:${masterUser.id}`;
	const orgRef = `org:${orgId}`;

	await stdb.callReducer("write_auth_tuples", [
		[
			{ user: userRef, relation: "member", object: orgRef },
			{ user: userRef, relation: "master", object: orgRef },
			{ user: userRef, relation: "admin", object: orgRef },
			{ user: userRef, relation: "can_view", object: orgRef },
			{ user: userRef, relation: "can_edit", object: orgRef },
			{ user: userRef, relation: "have_api_access", object: orgRef },
			{ user: userRef, relation: "have_billing_options", object: orgRef },
			{ user: userRef, relation: "have_webhook_access", object: orgRef },
		],
	]);

	return { org: { id: orgId, name: `E2E Test Org ${slug}`, slug }, masterUser, roles };
}

/**
 * Create a test user in an org with a given role.
 * Creates a real user in Keycloak and obtains a real JWT.
 */
export async function seedE2EUser(
	orgId: string,
	roleId: string,
): Promise<E2EUser> {
	const creds = initKeycloakCredentials();
	const stdb = STDBClient.getInstance();
	const id = uuidv4();
	const email = `e2e-${id.slice(0, 8)}@test.local`;
	const password = "E2eTest1!strong";

	// 1. Create user in Keycloak
	const keycloakUser = await createKeycloakTestUser(creds.url, creds.adminUser, creds.adminPassword, {
		email,
		firstName: "E2E",
		lastName: `User ${id.slice(0, 8)}`,
		password,
		realm: creds.realm,
	});

	// 2. Insert user in STDB with auth_service_id = Keycloak user ID
	await stdb.callReducer("create_user", [
		id,
		email,
		orgId,
		roleId,
		keycloakUser.keycloakUserId,
		`E2E User ${id.slice(0, 8)}`,
		true,
	]);

	// 3. Get real JWT access token from Keycloak
	const token = await getKeycloakAccessToken(
		creds.url,
		creds.realm,
		creds.clientId,
		creds.clientSecret,
		email,
		password,
	);

	return {
		id,
		token,
		email,
		authServiceId: keycloakUser.keycloakUserId,
	};
}

/**
 * Convenience: write auth tuples for a user based on role flags via STDB.
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
		have_gpg_access?: boolean;
		have_cert_access?: boolean;
		have_audit_access?: boolean;
	},
): Promise<void> {
	const stdb = STDBClient.getInstance();
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
	if (flags.have_gpg_access) tuples.push({ user, relation: "have_gpg_access", object: org });
	if (flags.have_cert_access) tuples.push({ user, relation: "have_cert_access", object: org });
	if (flags.have_audit_access) tuples.push({ user, relation: "have_audit_access", object: org });

	await stdb.callReducer("write_auth_tuples", [tuples]);
}

/**
 * Check service health before running E2E tests.
 * Throws if any required service is unreachable.
 */
export async function checkServiceHealth(): Promise<void> {
	const checks = [
		{
			name: "SpacetimeDB",
			check: async () => {
				const stdb = STDBClient.getInstance();
				const healthy = await stdb.healthCheck();
				if (!healthy) throw new Error("SpacetimeDB health check failed");
			},
		},
		{
			name: "Keycloak",
			check: async () => {
				const url = (process.env.KEYCLOAK_URL ?? "http://localhost:8080").replace(/\/$/, "");
				const realm = process.env.KEYCLOAK_REALM ?? "envsync";
				const res = await fetch(`${url}/realms/${realm}/.well-known/openid-configuration`, {
					signal: AbortSignal.timeout(5000),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

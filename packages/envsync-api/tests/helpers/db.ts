/**
 * Database seeding and cleanup helpers for tests.
 *
 * Uses SpacetimeDB (STDBClient) instead of PostgreSQL/Kysely.
 * Tables use singular names (e.g. "org", "user") and "uuid" for external IDs.
 */
import { randomUUID } from "node:crypto";

import { STDBClient } from "@/libs/stdb";

// STDB tables in cleanup order (children first)
const TABLES_IN_ORDER = [
	"team_member",
	"team",
	"env_store_pit_change_request",
	"env_store_pit",
	"secret_store_pit_change_request",
	"secret_store_pit",
	"webhook",
	"audit_log",
	"api_key",
	"org_certificate_meta",
	"gpg_key_meta",
	"settings",
	"env_type",
	"app",
	"user",
	"invite_user",
	"invite_org",
	"org_role",
	"org",
] as const;

/** Default role definitions matching RoleService.createDefaultRoles */
const DEFAULT_ROLES = [
	{
		name: "Org Admin",
		can_edit: true,
		can_view: true,
		have_api_access: true,
		have_billing_options: true,
		have_webhook_access: true,
		have_gpg_access: true,
		have_cert_access: true,
		have_audit_access: true,
		is_admin: true,
		is_master: true,
		color: "#FF5733",
	},
	{
		name: "Billing Admin",
		can_edit: false,
		can_view: false,
		have_api_access: false,
		have_billing_options: true,
		have_webhook_access: false,
		have_gpg_access: false,
		have_cert_access: false,
		have_audit_access: false,
		is_admin: false,
		is_master: false,
		color: "#33FF57",
	},
	{
		name: "Manager",
		can_edit: true,
		can_view: true,
		have_api_access: true,
		have_billing_options: false,
		have_webhook_access: true,
		have_gpg_access: false,
		have_cert_access: false,
		have_audit_access: true,
		is_admin: false,
		is_master: false,
		color: "#3357FF",
	},
	{
		name: "Developer",
		can_edit: true,
		can_view: true,
		have_api_access: false,
		have_billing_options: false,
		have_webhook_access: false,
		have_gpg_access: false,
		have_cert_access: false,
		have_audit_access: false,
		is_admin: false,
		is_master: false,
		color: "#572F13",
	},
	{
		name: "Viewer",
		can_edit: false,
		can_view: true,
		have_api_access: false,
		have_billing_options: false,
		have_webhook_access: false,
		have_gpg_access: false,
		have_cert_access: false,
		have_audit_access: false,
		is_admin: false,
		is_master: false,
		color: "#FF33A1",
	},
] as const;

export interface SeedOrgResult {
	org: { id: string; name: string; slug: string };
	roles: {
		master: { id: string; name: string };
		admin: { id: string; name: string };
		manager: { id: string; name: string };
		developer: { id: string; name: string };
		viewer: { id: string; name: string };
	};
	masterUser: { id: string; email: string; token: string; authServiceId: string };
}

/**
 * Seed a complete org with 5 default roles and a master user.
 * Returns all IDs + a mock token for the master user.
 */
export async function seedOrg(overrides?: {
	orgName?: string;
	orgSlug?: string;
	masterEmail?: string;
}): Promise<SeedOrgResult> {
	const stdb = STDBClient.getInstance();
	const orgId = randomUUID();
	const orgName = overrides?.orgName ?? "Test Org";
	const orgSlug = overrides?.orgSlug ?? `test-org-${orgId.slice(0, 8)}`;

	await stdb.callReducer("create_org", [orgId, orgName, orgSlug, {}]);

	// Create roles
	const roleRecords: { id: string; name: string }[] = [];
	for (const roleDef of DEFAULT_ROLES) {
		const roleId = randomUUID();
		await stdb.callReducer("create_org_role", [
			roleId,
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
		roleRecords.push({ id: roleId, name: roleDef.name });
	}

	const masterRole = roleRecords.find(r => r.name === "Org Admin")!;

	// Create master user
	const userId = randomUUID();
	const authServiceId = `kc-test-${userId.slice(0, 8)}`;
	const email = overrides?.masterEmail ?? `master-${userId.slice(0, 8)}@test.local`;

	await stdb.callReducer("create_user", [
		userId,
		email,
		orgId,
		masterRole.id,
		authServiceId,
		"Test Master",
		true,
	]);

	return {
		org: { id: orgId, name: orgName, slug: orgSlug },
		roles: {
			master: masterRole,
			admin: roleRecords.find(r => r.name === "Billing Admin")!,
			manager: roleRecords.find(r => r.name === "Manager")!,
			developer: roleRecords.find(r => r.name === "Developer")!,
			viewer: roleRecords.find(r => r.name === "Viewer")!,
		},
		masterUser: {
			id: userId,
			email,
			token: `test-token-${authServiceId}`,
			authServiceId,
		},
	};
}

/**
 * Create an additional user in a seeded org.
 */
export async function seedUser(
	orgId: string,
	roleId: string,
	overrides?: { email?: string; fullName?: string },
): Promise<{ id: string; email: string; token: string; authServiceId: string }> {
	const stdb = STDBClient.getInstance();
	const userId = randomUUID();
	const authServiceId = `kc-test-${userId.slice(0, 8)}`;
	const email = overrides?.email ?? `user-${userId.slice(0, 8)}@test.local`;

	await stdb.callReducer("create_user", [
		userId,
		email,
		orgId,
		roleId,
		authServiceId,
		overrides?.fullName ?? "Test User",
		true,
	]);

	return { id: userId, email, token: `test-token-${authServiceId}`, authServiceId };
}

/**
 * Seed an application within an org.
 */
export async function seedApp(
	orgId: string,
	overrides?: {
		name?: string;
		description?: string;
		enableSecrets?: boolean;
		isManagedSecret?: boolean;
		publicKey?: string;
		privateKey?: string;
	},
): Promise<{ id: string; name: string }> {
	const stdb = STDBClient.getInstance();
	const appId = randomUUID();
	const name = overrides?.name ?? `Test App ${appId.slice(0, 8)}`;

	await stdb.callReducer("create_app", [
		appId,
		orgId,
		name,
		overrides?.description ?? "A test application",
		overrides?.enableSecrets ?? false,
		overrides?.isManagedSecret ?? false,
		overrides?.publicKey ?? null,
		overrides?.privateKey ?? null,
		{},
	]);

	return { id: appId, name };
}

/**
 * Seed an environment type within an app.
 */
export async function seedEnvType(
	orgId: string,
	appId: string,
	overrides?: { name?: string; isDefault?: boolean; isProtected?: boolean; color?: string },
): Promise<{ id: string; name: string }> {
	const stdb = STDBClient.getInstance();
	const envTypeId = randomUUID();
	const name = overrides?.name ?? "development";

	await stdb.callReducer("create_env_type", [
		envTypeId,
		orgId,
		appId,
		name,
		overrides?.isDefault ?? true,
		overrides?.isProtected ?? false,
		overrides?.color ?? "#4CAF50",
	]);

	return { id: envTypeId, name };
}

/**
 * Truncate all tables — use between tests for clean state.
 */
export async function cleanupDB(): Promise<void> {
	const stdb = STDBClient.getInstance();
	for (const table of TABLES_IN_ORDER) {
		await stdb.callReducer("delete_all_from_table", [table], { injectRootKey: false });
	}
}

/**
 * Get the STDBClient instance for direct queries in tests.
 */
export function getSTDB(): STDBClient {
	return STDBClient.getInstance();
}

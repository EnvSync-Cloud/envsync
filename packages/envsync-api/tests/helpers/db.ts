/**
 * Database seeding and cleanup helpers for tests.
 */
import { randomUUID } from "node:crypto";

import { sql, type Kysely } from "kysely";

import { DB } from "@/libs/db";
import type { Database } from "@/types/db";

// Tables in FK-safe truncation order (children first)
const TABLES_IN_ORDER = [
	"team_members",
	"teams",
	"env_store_pit_change_request",
	"env_store_pit",
	"secret_store_pit_change_request",
	"secret_store_pit",
	"webhook_store",
	"audit_log",
	"api_keys",
	"org_certificates",
	"gpg_keys",
	"settings",
	"env_type",
	"app",
	"users",
	"invite_user",
	"invite_org",
	"org_role",
	"orgs",
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
	const db = await DB.getInstance();
	const orgId = randomUUID();
	const orgName = overrides?.orgName ?? "Test Org";
	const orgSlug = overrides?.orgSlug ?? `test-org-${orgId.slice(0, 8)}`;

	await db
		.insertInto("orgs")
		.values({
			id: orgId,
			name: orgName,
			slug: orgSlug,
			metadata: {},
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

	// Create roles
	const roleRecords: { id: string; name: string }[] = [];
	for (const roleDef of DEFAULT_ROLES) {
		const roleId = randomUUID();
		await db
			.insertInto("org_role")
			.values({
				id: roleId,
				...roleDef,
				org_id: orgId,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();
		roleRecords.push({ id: roleId, name: roleDef.name });
	}

	const masterRole = roleRecords.find(r => r.name === "Org Admin")!;

	// Create master user
	const userId = randomUUID();
	const authServiceId = `zitadel-test-${userId.slice(0, 8)}`;
	const email = overrides?.masterEmail ?? `master-${userId.slice(0, 8)}@test.local`;

	await db
		.insertInto("users")
		.values({
			id: userId,
			email,
			org_id: orgId,
			role_id: masterRole.id,
			auth_service_id: authServiceId,
			full_name: "Test Master",
			is_active: true,
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

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
	const db = await DB.getInstance();
	const userId = randomUUID();
	const authServiceId = `zitadel-test-${userId.slice(0, 8)}`;
	const email = overrides?.email ?? `user-${userId.slice(0, 8)}@test.local`;

	await db
		.insertInto("users")
		.values({
			id: userId,
			email,
			org_id: orgId,
			role_id: roleId,
			auth_service_id: authServiceId,
			full_name: overrides?.fullName ?? "Test User",
			is_active: true,
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

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
	const db = await DB.getInstance();
	const appId = randomUUID();
	const name = overrides?.name ?? `Test App ${appId.slice(0, 8)}`;

	await db
		.insertInto("app")
		.values({
			id: appId,
			org_id: orgId,
			name,
			description: overrides?.description ?? "A test application",
			enable_secrets: overrides?.enableSecrets ?? false,
			is_managed_secret: overrides?.isManagedSecret ?? false,
			public_key: overrides?.publicKey ?? null,
			private_key: overrides?.privateKey ?? null,
			metadata: {},
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

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
	const db = await DB.getInstance();
	const envTypeId = randomUUID();
	const name = overrides?.name ?? "development";

	await db
		.insertInto("env_type")
		.values({
			id: envTypeId,
			org_id: orgId,
			app_id: appId,
			name,
			is_default: overrides?.isDefault ?? true,
			is_protected: overrides?.isProtected ?? false,
			color: overrides?.color ?? "#4CAF50",
			created_at: new Date(),
			updated_at: new Date(),
		})
		.execute();

	return { id: envTypeId, name };
}

/**
 * Truncate all tables — use between tests for clean state.
 */
export async function cleanupDB(): Promise<void> {
	const db = await DB.getInstance();
	for (const table of TABLES_IN_ORDER) {
		await sql`TRUNCATE TABLE ${sql.raw(table)} CASCADE`.execute(db);
	}
}

/**
 * Get the Kysely DB instance for direct queries in tests.
 */
export async function getDB(): Promise<Kysely<Database>> {
	return DB.getInstance();
}

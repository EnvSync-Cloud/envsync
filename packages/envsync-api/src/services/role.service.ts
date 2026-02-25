import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { STDBClient } from "@/libs/stdb";
import { BusinessRuleError, NotFoundError, ValidationError } from "@/libs/errors";
import { AuthorizationService } from "@/services/authorization.service";

interface OrgRoleRow {
	uuid: string;
	name: string;
	color: string;
	org_id: string;
	can_edit: boolean;
	can_view: boolean;
	have_api_access: boolean;
	have_billing_options: boolean;
	have_webhook_access: boolean;
	have_gpg_access: boolean;
	have_cert_access: boolean;
	have_audit_access: boolean;
	is_admin: boolean;
	is_master: boolean;
	created_at: string;
	updated_at: string;
}

function mapRow(row: OrgRoleRow) {
	return {
		id: row.uuid,
		name: row.name,
		color: row.color,
		org_id: row.org_id,
		can_edit: row.can_edit,
		can_view: row.can_view,
		have_api_access: row.have_api_access,
		have_billing_options: row.have_billing_options,
		have_webhook_access: row.have_webhook_access,
		have_gpg_access: row.have_gpg_access,
		have_cert_access: row.have_cert_access,
		have_audit_access: row.have_audit_access,
		is_admin: row.is_admin,
		is_master: row.is_master,
		created_at: new Date(row.created_at),
		updated_at: new Date(row.updated_at),
	};
}

export class RoleService {
	private static stdb() {
		return STDBClient.getInstance();
	}

	public static createRole = async ({
		name,
		org_id,
		can_edit,
		can_view,
		have_api_access,
		have_billing_options,
		have_webhook_access,
		have_gpg_access,
		have_cert_access,
		have_audit_access,
		is_admin,
		is_master,
		color,
	}: {
		name: string;
		org_id: string;
		can_edit: boolean;
		can_view: boolean;
		have_api_access: boolean;
		have_billing_options: boolean;
		have_webhook_access: boolean;
		have_gpg_access: boolean;
		have_cert_access: boolean;
		have_audit_access: boolean;
		is_admin: boolean;
		is_master: boolean;
		color: string;
	}) => {
		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		const colorVal = color || "#000000";

		await this.stdb().callReducer("create_org_role", [
			id,
			name,
			colorVal,
			org_id,
			can_edit,
			can_view,
			have_api_access,
			have_billing_options,
			have_webhook_access,
			have_gpg_access,
			have_cert_access,
			have_audit_access,
			is_admin,
			is_master,
			now,
			now,
		]);

		await invalidateCache(CacheKeys.rolesByOrg(org_id));

		return { id, name };
	};

	public static createDefaultRoles = async (org_id: string) => {
		const rawRoles = [
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
		];

		const stdb = this.stdb();
		const now = new Date().toISOString();
		const roles: { id: string; name: string }[] = [];

		for (const role of rawRoles) {
			const id = crypto.randomUUID();
			await stdb.callReducer("create_org_role", [
				id,
				role.name,
				role.color,
				org_id,
				role.can_edit,
				role.can_view,
				role.have_api_access,
				role.have_billing_options,
				role.have_webhook_access,
				role.have_gpg_access,
				role.have_cert_access,
				role.have_audit_access,
				role.is_admin,
				role.is_master,
				now,
				now,
			]);
			roles.push({ id, name: role.name });
		}

		await invalidateCache(CacheKeys.rolesByOrg(org_id));

		return roles;
	};

	public static getRole = async (id: string) => {
		return cacheAside(CacheKeys.role(id), CacheTTL.LONG, async () => {
			const stdb = RoleService.stdb();

			const row = await stdb.queryOne<OrgRoleRow>(
				`SELECT * FROM org_role WHERE uuid = '${id}'`,
			);

			if (!row) {
				throw new NotFoundError("Role", id);
			}

			return mapRow(row);
		});
	};

	public static getRoles = async (org_id: string, page = 1, per_page = 50) => {
		const stdb = this.stdb();

		const rows = await stdb.queryPaginated<OrgRoleRow>(
			`SELECT * FROM org_role WHERE org_id = '${org_id}'`,
			per_page,
			(page - 1) * per_page,
		);

		return rows.map(mapRow);
	};

	public static getRoleStats = async (org_id: string) => {
		const stdb = this.stdb();

		const rows = await stdb.query<OrgRoleRow>(
			`SELECT * FROM org_role WHERE org_id = '${org_id}'`,
		);

		const stats = rows.map(mapRow);

		return {
			admin_access_count: stats.filter(role => role.is_admin).length,
			billing_access_count: stats.filter(role => role.have_billing_options).length,
			api_access_count: stats.filter(role => role.have_api_access).length,
			webhook_access_count: stats.filter(role => role.have_webhook_access).length,
			gpg_access_count: stats.filter(role => role.have_gpg_access).length,
			cert_access_count: stats.filter(role => role.have_cert_access).length,
			audit_access_count: stats.filter(role => role.have_audit_access).length,
			view_access_count: stats.filter(role => role.can_view).length,
			edit_access_count: stats.filter(role => role.can_edit).length,
			total_roles: stats.length,
		};
	};

	public static updateRole = async (
		id: string,
		org_id: string,
		data: {
			name?: string;
			can_edit?: boolean;
			can_view?: boolean;
			have_api_access?: boolean;
			have_billing_options?: boolean;
			have_webhook_access?: boolean;
			have_gpg_access?: boolean;
			have_cert_access?: boolean;
			have_audit_access?: boolean;
			is_admin?: boolean;
			is_master?: boolean;
			color?: string;
		},
	) => {
		// is_master is not allowed to be updated after creation
		if (data.is_master !== undefined) {
			throw new BusinessRuleError("is_master cannot be updated after creation");
		}

		const stdb = this.stdb();
		const now = new Date().toISOString();

		// Build SET clause dynamically from provided fields
		const setClauses: string[] = [];
		if (data.name !== undefined) setClauses.push(`name = '${data.name}'`);
		if (data.color !== undefined) setClauses.push(`color = '${data.color}'`);
		if (data.can_edit !== undefined) setClauses.push(`can_edit = ${data.can_edit}`);
		if (data.can_view !== undefined) setClauses.push(`can_view = ${data.can_view}`);
		if (data.have_api_access !== undefined) setClauses.push(`have_api_access = ${data.have_api_access}`);
		if (data.have_billing_options !== undefined) setClauses.push(`have_billing_options = ${data.have_billing_options}`);
		if (data.have_webhook_access !== undefined) setClauses.push(`have_webhook_access = ${data.have_webhook_access}`);
		if (data.have_gpg_access !== undefined) setClauses.push(`have_gpg_access = ${data.have_gpg_access}`);
		if (data.have_cert_access !== undefined) setClauses.push(`have_cert_access = ${data.have_cert_access}`);
		if (data.have_audit_access !== undefined) setClauses.push(`have_audit_access = ${data.have_audit_access}`);
		if (data.is_admin !== undefined) setClauses.push(`is_admin = ${data.is_admin}`);
		setClauses.push(`updated_at = '${now}'`);

		await stdb.callReducer("update_org_role", [
			id,
			org_id,
			JSON.stringify(data),
			now,
		]);

		// Re-sync FGA tuples for all users with this role
		await AuthorizationService.resyncAllUsersWithRole(id, org_id);

		await invalidateCache(CacheKeys.role(id), CacheKeys.rolesByOrg(org_id));
	};

	public static deleteRole = async (id: string, org_id: string) => {
		const stdb = this.stdb();

		// is_master role cannot be deleted
		const row = await stdb.queryOne<OrgRoleRow>(
			`SELECT * FROM org_role WHERE uuid = '${id}' AND org_id = '${org_id}'`,
		);

		if (!row) {
			throw new NotFoundError("Role", id);
		}

		const role = mapRow(row);

		if (role.is_master) {
			throw new BusinessRuleError("Cannot delete master role");
		}

		await stdb.callReducer("delete_org_role", [id]);

		await invalidateCache(CacheKeys.role(id), CacheKeys.rolesByOrg(org_id));
	};

	public static checkPermission = async (
		role_id: string,
		permission:
			| "can_edit"
			| "can_view"
			| "have_api_access"
			| "have_billing_options"
			| "have_webhook_access"
			| "have_gpg_access"
			| "have_cert_access"
			| "have_audit_access"
			| "is_admin"
			| "is_master",
	) => {
		const role = await RoleService.getRole(role_id);

		if (!role) {
			throw new ValidationError("Role not found");
		}

		if (role.is_master) {
			return true; // Master role has all permissions
		}

		if (role.is_admin && permission !== "is_master") {
			return true; // Admin role has all permissions except is_master
		}

		// Check if the permission exists on the role
		if (role[permission] === undefined) {
			throw new ValidationError(`Permission ${permission} does not exist on role`);
		}

		return role[permission];
	};
}

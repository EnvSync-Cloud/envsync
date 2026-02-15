import { v4 as uuidv4 } from "uuid";

import { DB } from "@/libs/db";

export class RoleService {
	public static createRole = async ({
		name,
		org_id,
		can_edit,
		can_view,
		have_api_access,
		have_billing_options,
		have_webhook_access,
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
		is_admin: boolean;
		is_master: boolean;
		color: string;
	}) => {
		const db = await DB.getInstance();

		const { id } = await db
			.insertInto("org_role")
			.values({
				id: uuidv4(),
				name,
				color: color || "#000000", // Default color, can be changed later
				org_id,
				can_edit,
				can_view,
				have_api_access,
				have_billing_options,
				have_webhook_access,
				is_admin,
				is_master,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returning("id")
			.executeTakeFirstOrThrow();

		return { id, name };
	};

	public static createDefaultRoles = async (org_id: string) => {
		const db = await DB.getInstance();

		const rawRoles = [
			{
				name: "Org Admin",
				can_edit: true,
				can_view: true,
				have_api_access: true,
				have_billing_options: true,
				have_webhook_access: true,
				is_admin: true,
				is_master: true,
				color: "#FF5733", // Example color for Org Admin
			},
			{
				name: "Billing Admin",
				can_edit: false,
				can_view: false,
				have_api_access: false,
				have_billing_options: true,
				have_webhook_access: false,
				is_admin: false,
				color: "#33FF57", // Example color for Billing Admin
			},
			{
				name: "Manager",
				can_edit: true,
				can_view: true,
				have_api_access: true,
				have_billing_options: false,
				have_webhook_access: true,
				is_admin: false,
				color: "#3357FF", // Example color for Manager
			},
			{
				name: "Developer",
				can_edit: true,
				can_view: true,
				have_api_access: false,
				have_billing_options: false,
				have_webhook_access: false,
				is_admin: false,
				color: "#572F13", // Example color for Developer
			},
			{
				name: "Viewer",
				can_edit: false,
				can_view: true,
				have_api_access: false,
				have_billing_options: false,
				have_webhook_access: false,
				is_admin: false,
				color: "#FF33A1", // Example color for Viewer
			},
		];

		const roleInserts = rawRoles.map(role => ({
			id: uuidv4(),
			...role,
			org_id,
			created_at: new Date(),
			updated_at: new Date(),
		}));

		const roles = await db
			.insertInto("org_role")
			.values(roleInserts)
			.returning("name")
			.returning("id")
			.execute();

		return roles;
	};

	public static getRole = async (id: string) => {
		const db = await DB.getInstance();

		const role = await db
			.selectFrom("org_role")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		return role;
	};

	public static getRoles = async (org_id: string) => {
		const db = await DB.getInstance();

		const role = await db.selectFrom("org_role").selectAll().where("org_id", "=", org_id).execute();

		return role;
	};

	public static getRoleStats = async (org_id: string) => {
		const db = await DB.getInstance();

		const stats = await db
			.selectFrom("org_role")
			.selectAll()
			.where("org_id", "=", org_id)
			.execute();

		return {
			admin_access_count: stats.filter(role => role.is_admin).length,
			billing_access_count: stats.filter(role => role.have_billing_options).length,
			api_access_count: stats.filter(role => role.have_api_access).length,
			webhook_access_count: stats.filter(role => role.have_webhook_access).length,
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
			is_admin?: boolean;
			is_master?: boolean;
			color?: string;
		},
	) => {
		const db = await DB.getInstance();

		// is_master is not allowed to be updated after creation
		if (data.is_master !== undefined) {
			throw new Error("is_master cannot be updated after creation");
		}

		await db
			.updateTable("org_role")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.where("is_master", "=", false)
			.where("org_id", "=", org_id)
			.execute();
	};

	public static deleteRole = async (id: string, org_id: string) => {
		const db = await DB.getInstance();

		// is_master role cannot be deleted
		const role = await db
			.selectFrom("org_role")
			.selectAll()
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.executeTakeFirstOrThrow();

		if (role.is_master) {
			throw new Error("Cannot delete master role");
		}

		await db.deleteFrom("org_role").where("id", "=", id).executeTakeFirstOrThrow();
	};

	public static checkPermission = async (
		role_id: string,
		permission:
			| "can_edit"
			| "can_view"
			| "have_api_access"
			| "have_billing_options"
			| "have_webhook_access"
			| "is_admin"
			| "is_master",
	) => {
		const db = await DB.getInstance();

		const role = await db
			.selectFrom("org_role")
			.selectAll()
			.where("id", "=", role_id)
			.executeTakeFirstOrThrow();

		if (!role) {
			throw new Error("Role not found");
		}

		if (role.is_master) {
			return true; // Master role has all permissions
		}

		if (role.is_admin && permission !== "is_master") {
			return true; // Admin role has all permissions except is_master
		}

		// Check if the permission exists on the role
		if (role[permission] === undefined) {
			throw new Error(`Permission ${permission} does not exist on role`);
		}

		return role[permission];
	};
}

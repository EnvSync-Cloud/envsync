import { type Context } from "hono";

import { RoleService } from "@/services/role.service";
import { AuditLogService } from "@/services/audit_log.service";
import infoLogs, { LogTypes} from "@/libs/logger";

export class RoleController {
	public static readonly getAllRoles = async (c: Context) => {
		const org_id = c.get("org_id");

		if (!org_id) {
			return c.json({ error: "Organization ID is required." }, 400);
		}

		const page = Math.max(1, Number(c.req.query("page")) || 1);
		const per_page = Math.min(100, Math.max(1, Number(c.req.query("per_page")) || 50));

		const roles = await RoleService.getRoles(org_id, page, per_page);

		await AuditLogService.notifyAuditSystem({
			action: "roles_viewed",
			org_id,
			user_id: c.get("user_id"),
			details: {
				roles_count: roles.length,
			},
			message: "Roles retrieved successfully.",
		});

		return c.json(roles, 200);
	};

	public static readonly createRole = async (c: Context) => {
		const org_id = c.get("org_id");

		const {
			name,
			can_edit,
			can_view,
			have_api_access,
			have_billing_options,
			have_webhook_access,
			have_gpg_access,
			have_cert_access,
			have_audit_access,
			is_admin,
			color,
		} = await c.req.json();

		if (!name || !org_id) {
			return c.json({ error: "Name and Organization ID are required." }, 400);
		}

		const role = await RoleService.createRole({
			org_id,
			name,
			can_edit,
			can_view,
			have_api_access,
			have_billing_options,
			have_webhook_access,
			have_gpg_access: have_gpg_access ?? false,
			have_cert_access: have_cert_access ?? false,
			have_audit_access: have_audit_access ?? false,
			is_admin,
			is_master: false,
			color,
		});

		// Log the creation of the role
		await AuditLogService.notifyAuditSystem({
			action: "role_created",
			org_id,
			user_id: c.get("user_id"),
			message: `Role ${role.name} created.`,
			details: {
				role_id: role.id,
				name: role.name,
			},
		});

		return c.json(role, 201);
	};

	public static readonly deleteRole = async (c: Context) => {
		const id = c.req.param("id");
		const org_id = c.get("org_id");

		if (!id) {
			return c.json({ error: "Role ID is required." }, 400);
		}

		await RoleService.deleteRole(id, org_id);

		// Log the deletion of the role
		await AuditLogService.notifyAuditSystem({
			action: "role_deleted",
			org_id,
			user_id: c.get("user_id"),
			message: `Role with ID ${id} deleted.`,
			details: {
				role_id: id,
			},
		});

		return c.json({ message: "Role deleted successfully." }, 200);
	};

	public static readonly getRoleStats = async (c: Context) => {
		const org_id = c.get("org_id");

		if (!org_id) {
			return c.json({ error: "Organization ID is required." }, 400);
		}

		const stats = await RoleService.getRoleStats(org_id);

		return c.json(stats, 200);
	};

	public static readonly updateRole = async (c: Context) => {
		const id = c.req.param("id");

		const org_id = c.get("org_id");

		const {
			name,
			can_edit,
			can_view,
			have_api_access,
			have_billing_options,
			have_webhook_access,
			have_gpg_access,
			have_cert_access,
			have_audit_access,
			is_admin,
			color,
		} = await c.req.json();

		if (!id) {
			return c.json({ error: "Role ID is required." }, 400);
		}

		infoLogs(`Updating role ${id} with data: ${JSON.stringify({
			name,
			can_edit,
			can_view,
			have_api_access,
			have_billing_options,
			have_webhook_access,
			have_gpg_access,
			have_cert_access,
			have_audit_access,
			is_admin,
			color,
		})}`, LogTypes.LOGS, "RoleController.updateRole");

		await RoleService.updateRole(id, org_id, {
			name,
			can_edit,
			can_view,
			have_api_access,
			have_billing_options,
			have_webhook_access,
			have_gpg_access,
			have_cert_access,
			have_audit_access,
			is_admin,
			color,
		});

		// Log the update of the role
		await AuditLogService.notifyAuditSystem({
			action: "role_updated",
			org_id,
			user_id: c.get("user_id"),
			message: `Role with ID ${id} updated.`,
			details: {
				role_id: id,
			},
		});

		return c.json({ message: "Role updated successfully." }, 200);
	};

	public static readonly getRole = async (c: Context) => {
		const id = c.req.param("id");
		const org_id = c.get("org_id");

		if (!id) {
			return c.json({ error: "Role ID is required." }, 400);
		}

		const role = await RoleService.getRole(id);

		if (role.org_id !== org_id) {
			return c.json({ error: "Role not found in this organization." }, 404);
		}

		// Log the retrieval of the role
		await AuditLogService.notifyAuditSystem({
			action: "role_viewed",
			org_id,
			user_id: c.get("user_id"),
			message: `Role with ID ${id} viewed.`,
			details: {
				role_id: id,
				role_name: role.name,
			},
		});

		return c.json(role, 200);
	};
}

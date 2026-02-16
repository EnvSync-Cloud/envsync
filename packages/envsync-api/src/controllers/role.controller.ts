import { type Context } from "hono";

import { RoleService } from "@/services/role.service";
import { AuditLogService } from "@/services/audit_log.service";

export class RoleController {
	public static readonly getAllRoles = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			if (!org_id) {
				return c.json({ error: "Organization ID is required." }, 400);
			}

			const roles = await RoleService.getRoles(org_id);

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
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly createRole = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			const {
				name,
				can_edit,
				can_view,
				have_api_access,
				have_billing_options,
				have_webhook_access,
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
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly deleteRole = async (c: Context) => {
		try {
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
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getRoleStats = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			if (!org_id) {
				return c.json({ error: "Organization ID is required." }, 400);
			}

			const stats = await RoleService.getRoleStats(org_id);

			return c.json(stats, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly updateRole = async (c: Context) => {
		try {
			const id = c.req.param("id");

			const org_id = c.get("org_id");

			const data = await c.req.json();

			if (!id) {
				return c.json({ error: "Role ID is required." }, 400);
			}

			await RoleService.updateRole(id, org_id, data);

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
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getRole = async (c: Context) => {
		try {
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
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};
}

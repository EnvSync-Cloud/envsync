import type { Context } from "hono";

import {
	updateZitadelUser,
	deleteZitadelUser,
	sendZitadelPasswordReset,
} from "@/helpers/zitadel";
import { UserService } from "@/services/user.service";
import { AuditLogService } from "@/services/audit_log.service";

export class UserController {
	public static readonly getUsers = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const users = await UserService.getAllUser(org_id);

			await AuditLogService.notifyAuditSystem({
				action: "users_retrieved",
				org_id: org_id,
				user_id: c.get("user_id"),
				message: `retrieved all users.`,
				details: {
					count: users.length,
				},
			});

			return c.json(users);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getUserById = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const { id } = c.req.param();

			if (!id) {
				return c.json({ error: "ID is required." }, 400);
			}

			const user = await UserService.getUser(id);

			if (!user) {
				return c.json({ error: "User not found." }, 404);
			}
			if (user.org_id !== org_id) {
				return c.json({ error: "You do not have permission to access this user." }, 403);
			}

			await AuditLogService.notifyAuditSystem({
				action: "user_retrieved",
				org_id: org_id,
				user_id: c.get("user_id"),
				message: `retrieved user with ID ${id}.`,
				details: { user_id: id },
			});

			return c.json(user);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly updateUser = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			const { id } = c.req.param();
			const { full_name, profile_picture_url, email } = await c.req.json();

			if (!id) {
				return c.json({ error: "ID is required." }, 400);
			}

			const user = await UserService.getUser(id);
			if (!user) {
				return c.json({ error: "User not found." }, 404);
			}
			if (user.org_id !== org_id) {
				return c.json({ error: "You do not have permission to update this user." }, 403);
			}

			const updateData = {
				full_name: full_name ?? user.full_name,
				profile_picture_url: profile_picture_url ?? user.profile_picture_url,
				email: email ?? user.email,
			};

			if (user.keycloak_id) {
				const parts = (updateData.full_name ?? "").trim().split(/\s+/);
				await updateZitadelUser(user.keycloak_id, {
					firstName: parts[0],
					lastName: parts.slice(1).join(" ") || "",
					email: updateData.email,
				});
			}

			await UserService.updateUser(id, updateData);

			await AuditLogService.notifyAuditSystem({
				action: "user_updated",
				org_id: org_id,
				user_id: c.get("user_id"),
				message: `updated user with ID ${id}.`,
				details: { user_id: id, fields: { full_name, profile_picture_url, email } },
			});

			return c.json({ message: "User updated successfully." });
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static deleteUser = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const permissions = c.get("permissions");

			const { id } = c.req.param();

			if (!id) {
				return c.json({ error: "ID is required." }, 400);
			}

			const user = await UserService.getUser(id);
			if (!user) {
				return c.json({ error: "User not found." }, 404);
			}
			if (user.org_id !== org_id) {
				return c.json({ error: "You do not have permission to delete this user." }, 403);
			}
			if (!permissions.is_admin && !permissions.is_master) {
				return c.json({ error: "You do not have permission to delete this user." }, 403);
			}

			if (user.keycloak_id) {
				await deleteZitadelUser(user.keycloak_id);
			}
			await UserService.deleteUser(id);

			await AuditLogService.notifyAuditSystem({
				action: "user_deleted",
				org_id: org_id,
				user_id: c.get("user_id"),
				message: `deleted user with ID ${id}.`,
				details: { user_id: id },
			});

			return c.json({ message: "User deleted successfully." });
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly updateRole = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const permissions = c.get("permissions");

			const { id } = c.req.param();
			const { role_id } = await c.req.json();

			if (!id || !role_id) {
				return c.json({ error: "ID and role ID are required." }, 400);
			}

			const user = await UserService.getUser(id);
			if (!user) {
				return c.json({ error: "User not found." }, 404);
			}
			if (user.org_id !== org_id) {
				return c.json({ error: "You do not have permission to update this user." }, 403);
			}

			if (permissions.is_admin !== true && permissions.is_master !== true) {
				return c.json({ error: "You do not have permission to update roles." }, 403);
			}

			await UserService.updateUser(id, { role_id });

			await AuditLogService.notifyAuditSystem({
				action: "user_role_updated",
				org_id: org_id,
				user_id: c.get("user_id"),
				message: `updated role for user with ID ${id}.`,
				details: { user_id: id, role_id },
			});

			return c.json({ message: "User role updated successfully." });
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly updatePassword = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			const { id } = c.req.param();

			if (!id) {
				return c.json({ error: "ID is required." }, 400);
			}

			const user = await UserService.getUser(id);
			if (!user) {
				return c.json({ error: "User not found." }, 404);
			}
			if (user.org_id !== org_id) {
				return c.json({ error: "You do not have permission to update this user." }, 403);
			}

			if (user.keycloak_id) {
				await sendZitadelPasswordReset(user.keycloak_id);
			}

			await AuditLogService.notifyAuditSystem({
				action: "password_update_requested",
				org_id: org_id,
				user_id: c.get("user_id"),
				message: `requested password update for user with ID ${id}.`,
				details: { user_id: id },
			});

			return c.json({ message: "Password update request sent!" });
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};
}

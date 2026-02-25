import type { Context } from "hono";

import {
	updateKeycloakUser,
	deleteKeycloakUser,
	sendKeycloakPasswordReset,
} from "@/helpers/keycloak";
import { UserService } from "@/services/user.service";
import { AuditLogService } from "@/services/audit_log.service";

export class UserController {
	public static readonly getUsers = async (c: Context) => {
		const org_id = c.get("org_id");

		const page = Math.max(1, Number(c.req.query("page")) || 1);
		const per_page = Math.min(100, Math.max(1, Number(c.req.query("per_page")) || 50));

		const users = await UserService.getAllUser(org_id, page, per_page);

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
	};

	public static readonly getUserById = async (c: Context) => {
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
	};

	public static readonly updateUser = async (c: Context) => {
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

		if (user.auth_service_id) {
			const parts = (updateData.full_name ?? "").trim().split(/\s+/);
			await updateKeycloakUser(user.auth_service_id, {
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
	};

	public static readonly deleteUser = async (c: Context) => {
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
			return c.json({ error: "You do not have permission to delete this user." }, 403);
		}

		if (user.auth_service_id) {
			await deleteKeycloakUser(user.auth_service_id);
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
	};

	public static readonly updateRole = async (c: Context) => {
		const org_id = c.get("org_id");

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

		await UserService.updateUser(id, { role_id });

		await AuditLogService.notifyAuditSystem({
			action: "user_role_updated",
			org_id: org_id,
			user_id: c.get("user_id"),
			message: `updated role for user with ID ${id}.`,
			details: { user_id: id, role_id },
		});

		return c.json({ message: "User role updated successfully." });
	};

	public static readonly updatePassword = async (c: Context) => {
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

		if (user.auth_service_id) {
			await sendKeycloakPasswordReset(user.auth_service_id);
		}

		await AuditLogService.notifyAuditSystem({
			action: "password_update_requested",
			org_id: org_id,
			user_id: c.get("user_id"),
			message: `requested password update for user with ID ${id}.`,
			details: { user_id: id },
		});

		return c.json({ message: "Password update request sent!" });
	};
}

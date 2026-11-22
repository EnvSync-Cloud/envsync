import type { Context } from "hono";

import {
	updateDirectoryUser,
	deleteDirectoryUser,
	sendDirectoryPasswordReset,
	directoryUserHasPassword,
	setDirectoryUserPassword,
	getDirectoryMfaEnabled,
	beginDirectoryMfa,
	confirmDirectoryMfa,
	disableDirectoryMfa,
	getDirectoryUserById,
	passwordGrantLogin,
} from "@/helpers/identity";
import { composeProfileName, splitProfileName } from "@/helpers/profile-name";
import { UserService } from "@/services/user.service";
import { AuditLogService } from "@/services/audit_log.service";
import { OrgAdminGuardService } from "@/services/org-admin-guard.service";
import { config } from "@/utils/env";

async function ownUser(c: Context) {
	const id = c.get("user_id") as string | undefined;
	const orgId = c.get("org_id") as string | undefined;
	if (!id) return null;
	const user = await UserService.getUser(id);
	if (!user || (orgId && user.org_id !== orgId)) return null;
	return user;
}

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
		const { full_name, first_name, last_name, profile_picture_url, email } = await c.req.json();

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

		const composedName = composeProfileName({
			fullName: full_name,
			firstName: first_name,
			lastName: last_name,
			currentFullName: user.full_name,
		});
		const updateData = {
			full_name: composedName,
			profile_picture_url: profile_picture_url ?? user.profile_picture_url,
			email: email ?? user.email,
		};

		if (user.auth_service_id) {
			const parts = (updateData.full_name ?? "").trim().split(/\s+/);
			await updateDirectoryUser(user.auth_service_id, {
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
			details: {
				user_id: id,
				fields: {
					full_name: updateData.full_name,
					profile_picture_url,
					email,
				},
			},
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

		await OrgAdminGuardService.ensureOrgHasAdminAfterUserDeletion(org_id, id);
		const deleteIdentity = user.auth_service_id
			? !(await UserService.hasOtherMembershipsForAuthService(user.auth_service_id, id))
			: false;
		await UserService.deleteUser(id);
		if (deleteIdentity && user.auth_service_id) {
			try {
				await deleteDirectoryUser(user.auth_service_id);
			} catch (error) {
				console.error("Failed to delete Atrium user after org membership deletion:", error);
			}
		}

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
			const hasPassword = await directoryUserHasPassword(user.auth_service_id);
			if (!hasPassword) {
				return c.json(
					{
						error: "This user signs in with SSO and has no password to reset.",
						code: "AUTH_SSO_PASSWORD_DISABLED",
					},
					409,
				);
			}
			await sendDirectoryPasswordReset(user.auth_service_id);
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

	public static readonly getAccountSecurity = async (c: Context) => {
		const user = await ownUser(c);
		if (!user) {
			return c.json({ error: "User not found." }, 404);
		}
		const names = splitProfileName(user.full_name);
		let hasPassword = false;
		let mfaEnabled = false;
		if (user.auth_service_id) {
			try {
				[hasPassword, mfaEnabled] = await Promise.all([
					directoryUserHasPassword(user.auth_service_id),
					getDirectoryMfaEnabled(user.auth_service_id),
				]);
			} catch (error) {
				console.error(
					"Account security lookup failed:",
					error instanceof Error ? error.message : "unknown",
				);
				return c.json({ error: "Sign-in settings could not be loaded." }, 502);
			}
		}
		return c.json({
			first_name: names.firstName,
			last_name: names.lastName,
			email: user.email,
			has_password: hasPassword,
			mfa_enabled: mfaEnabled,
			sign_in_methods: hasPassword
				? [{ id: "password", name: "Password", linked: true }]
				: [],
		});
	};

	public static readonly setOwnPassword = async (c: Context) => {
		const user = await ownUser(c);
		if (!user) {
			return c.json({ error: "User not found." }, 404);
		}
		if (!user.auth_service_id) {
			return c.json({ error: "This account has no sign-in directory.", code: "NO_DIRECTORY" }, 409);
		}
		const { password } = c.req.valid("json" as never) as { password: string };
		try {
			if (await directoryUserHasPassword(user.auth_service_id)) {
				return c.json(
					{
						error: "This account already has a password. Use the reset email.",
						code: "PASSWORD_ALREADY_SET",
					},
					409,
				);
			}
			await setDirectoryUserPassword(user.auth_service_id, password);
		} catch (error) {
			console.error("Set password failed:", error instanceof Error ? error.message : "unknown");
			return c.json({ error: "Choose a different password.", code: "PASSWORD_REJECTED" }, 400);
		}
		await AuditLogService.notifyAuditSystem({
			action: "password_set",
			org_id: c.get("org_id"),
			user_id: user.id,
			message: "set a password",
			details: { user_id: user.id },
		});
		return c.json({ message: "Password set." });
	};

	public static readonly setupMfa = async (c: Context) => {
		const user = await ownUser(c);
		if (!user?.auth_service_id) {
			return c.json({ error: "This account has no sign-in directory.", code: "NO_DIRECTORY" }, 409);
		}
		try {
			const enrollment = await beginDirectoryMfa(user.auth_service_id);
			await AuditLogService.notifyAuditSystem({
				action: "mfa_enrollment_started",
				org_id: c.get("org_id"),
				user_id: user.id,
				message: "started authenticator setup",
				details: { user_id: user.id },
			});
			return c.json(enrollment);
		} catch (error) {
			console.error("MFA setup failed:", error instanceof Error ? error.message : "unknown");
			return c.json({ error: "Authenticator setup could not start." }, 502);
		}
	};

	public static readonly confirmMfa = async (c: Context) => {
		const user = await ownUser(c);
		if (!user?.auth_service_id) {
			return c.json({ error: "This account has no sign-in directory.", code: "NO_DIRECTORY" }, 409);
		}
		const { code } = c.req.valid("json" as never) as { code: string };
		try {
			await confirmDirectoryMfa(user.auth_service_id, code);
		} catch (error) {
			console.error("MFA confirm failed:", error instanceof Error ? error.message : "unknown");
			return c.json({ error: "That code is not valid.", code: "MFA_CODE_INVALID" }, 400);
		}
		await AuditLogService.notifyAuditSystem({
			action: "mfa_enabled",
			org_id: c.get("org_id"),
			user_id: user.id,
			message: "turned on an authenticator",
			details: { user_id: user.id },
		});
		return c.json({ message: "Authenticator is on." });
	};

	public static readonly disableMfa = async (c: Context) => {
		const user = await ownUser(c);
		if (!user?.auth_service_id) {
			return c.json({ error: "This account has no sign-in directory.", code: "NO_DIRECTORY" }, 409);
		}
		const { password } = c.req.valid("json" as never) as { password: string };
		const directoryUser = await getDirectoryUserById(user.auth_service_id);
		const username = directoryUser?.username || user.email;
		if (!username) {
			return c.json({ error: "This account has no sign-in name.", code: "NO_DIRECTORY" }, 409);
		}
		try {
			await passwordGrantLogin(
				username,
				password,
				config.ATRIUM_API_CLIENT_ID,
				config.ATRIUM_API_CLIENT_SECRET,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			if (message.includes("unauthorized_client") || message.includes("unsupported_grant")) {
				return c.json(
					{ error: "Password check is not available.", code: "STEP_UP_UNAVAILABLE" },
					503,
				);
			}
			return c.json({ error: "Password is not valid.", code: "STEP_UP_FAILED" }, 401);
		}
		try {
			await disableDirectoryMfa(user.auth_service_id);
		} catch (error) {
			console.error("MFA disable failed:", error instanceof Error ? error.message : "unknown");
			return c.json({ error: "The authenticator could not be turned off." }, 502);
		}
		await AuditLogService.notifyAuditSystem({
			action: "mfa_disabled",
			org_id: c.get("org_id"),
			user_id: user.id,
			message: "turned off an authenticator",
			details: { user_id: user.id },
		});
		return c.json({ message: "Authenticator is off." });
	};
}

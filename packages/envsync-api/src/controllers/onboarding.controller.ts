import { type Context } from "hono";

import { OrgService } from "@/services/org.service";
import { RoleService } from "@/services/role.service";
import { slugifyName } from "@/utils/random";
import { UserService } from "@/services/user.service";
import { InviteService } from "@/services/invite.service";
import { onOrgOnboardingInvite, onUserOnboardingInvite } from "@/libs/mail";
import { AuditLogService } from "@/services/audit_log.service";
import { isPasswordStrong } from "@/utils/password";
import { config } from "@/utils/env";

export class OnboardingController {
	public static readonly createOrgInvite = async (c: Context) => {
		try {
			const { email } = await c.req.json();

			if (!email) {
				return c.json({ error: "Email is required." }, 400);
			}

			const invite_code = await InviteService.createOrgInvite(email);

			await onOrgOnboardingInvite(email, {
				accept_link: `${config.LANDING_PAGE_URL}/onboarding/accept-org-invite/${invite_code}`,
			});

			return c.json({ message: "Organization invite created successfully." }, 201);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly acceptOrgInvite = async (c: Context) => {
		try {
			const { invite_code } = c.req.param();

			const {
				org_data: { name, size, website },
				user_data: { full_name, password },
			} = await c.req.json();

			if (!invite_code || !name) {
				return c.json({ error: "All fields are required." }, 400);
			}

			if (!isPasswordStrong(password)) {
				return c.json(
					{
						error:
							"Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character.",
					},
					400,
				);
			}

			const invite_data = await InviteService.getOrgInviteByCode(invite_code);
			if (!invite_data) {
				return c.json({ error: "Invite not found." }, 404);
			}
			if (invite_data.is_accepted) {
				return c.json({ error: "Invite already accepted." }, 400);
			}

			// Create Org
			const org_id = await OrgService.createOrg({
				name,
				slug: slugifyName(name),
				size,
				website,
			});

			// Create Roles
			const roles = await RoleService.createDefaultRoles(org_id);
			const admin_role_id = roles.find(role => role.name === "Org Admin")?.id || "";

			// Create User
			const user = await UserService.createUser({
				email: invite_data.email,
				full_name,
				password,
				org_id,
				role_id: admin_role_id,
			});

			// Accept Invite
			await InviteService.updateOrgInvite(invite_data.id, {
				is_accepted: true,
			});

			// Log the organization creation
			await AuditLogService.notifyAuditSystem({
				action: "org_created",
				org_id,
				user_id: user.id,
				message: `Organization created.`,
				details: {
					name,
				},
			});

			return c.json({ message: "Organization created successfully." }, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getOrgInviteByCode = async (c: Context) => {
		try {
			const { invite_code } = c.req.param();

			if (!invite_code) {
				return c.json({ error: "Invite code is required." }, 400);
			}

			const invite = await InviteService.getOrgInviteByCode(invite_code);

			return c.json({ invite }, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly createUserInvite = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const permissions = c.get("permissions");

			const { email, role_id } = await c.req.json();

			if (!email || !role_id) {
				return c.json({ error: "Email and role ID are required." }, 400);
			}

			// only Admin can create user invites
			if (!permissions.is_admin || !permissions.is_master) {
				return c.json({ error: "Only Admin can create user invites." }, 403);
			}

			const invite = await InviteService.createUserInvite(email, org_id, role_id);
			const org = await OrgService.getOrg(org_id);

			await onUserOnboardingInvite(email, {
				accept_link: `${config.LANDING_PAGE_URL}/onboarding/accept-user-invite/${invite.invite_token}`,
				org_name: org.name,
			});

			// Log the user invite creation
			await AuditLogService.notifyAuditSystem({
				action: "user_invite_created",
				org_id,
				user_id: c.get("user_id"),
				message: `User invite created for ${email}.`,
				details: {
					invite_id: invite.id,
					email,
					role_id,
				},
			});

			return c.json({ message: "User invite created successfully." }, 201);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly acceptUserInvite = async (c: Context) => {
		try {
			const { invite_code } = c.req.param();

			const { full_name, password } = await c.req.json();

			if (!invite_code || !full_name || !password) {
				return c.json({ error: "All fields are required." }, 400);
			}

			if (!isPasswordStrong(password)) {
				return c.json(
					{
						error:
							"Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character.",
					},
					400,
				);
			}

			// Check if the invite code is valid and not already accepted
			const invite = await InviteService.getUserInviteByCode(invite_code);
			if (!invite) {
				return c.json({ error: "Invite not found." }, 404);
			}
			if (invite.is_accepted) {
				return c.json({ error: "Invite already accepted." }, 400);
			}

			// create user
			const user = await UserService.createUser({
				email: invite.email,
				full_name,
				password,
				org_id: invite.org_id,
				role_id: invite.role_id,
			});

			// update invite
			await InviteService.updateUserInvite(invite.id, {
				is_accepted: true,
			});

			// Log the user invite acceptance
			await AuditLogService.notifyAuditSystem({
				action: "user_invite_accepted",
				org_id: invite.org_id,
				user_id: user.id,
				message: `User invite accepted`,
				details: {
					invite_id: invite.id,
					email: invite.email,
					role_id: invite.role_id,
				},
			});

			return c.json({ message: "User invite accepted successfully." }, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getUserInviteByCode = async (c: Context) => {
		try {
			const { invite_code } = c.req.param();

			if (!invite_code) {
				return c.json({ error: "Invite code is required." }, 400);
			}

			const invite = await InviteService.getUserInviteByCode(invite_code);

			return c.json({ invite }, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	// update user invite
	public static readonly updateUserInvite = async (c: Context) => {
		try {
			const permissions = c.get("permissions");

			// only Admin can update user invites
			if (!permissions.is_admin || !permissions.is_master) {
				return c.json({ error: "Only Admin can update user invites." }, 403);
			}

			const { invite_code } = c.req.param();

			const { role_id } = await c.req.json();

			if (!invite_code || !role_id) {
				return c.json({ error: "All fields are required." }, 400);
			}

			const invite = await InviteService.getUserInviteByCode(invite_code);

			if (!invite) {
				return c.json({ error: "Invite not found." }, 404);
			}

			await InviteService.updateUserInvite(invite.id, {
				role_id,
			});

			// Log the user invite update
			await AuditLogService.notifyAuditSystem({
				action: "user_invite_updated",
				org_id: invite.org_id,
				user_id: c.get("user_id"),
				message: `User invite updated for ${invite.email}.`,
				details: {
					invite_id: invite.id,
					email: invite.email,
					role_id,
				},
			});

			return c.json({ message: "User invite updated successfully." }, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly deleteUserInvite = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const { invite_id } = c.req.param();

			const permissions = c.get("permissions");

			// only Admin can delete user invites
			if (!permissions.is_admin || !permissions.is_master) {
				return c.json({ error: "Only Admin can delete user invites." }, 403);
			}

			if (!invite_id) {
				return c.json({ error: "Invite id is required." }, 400);
			}

			const invite = await InviteService.getUserInviteById(invite_id);

			await InviteService.deleteUserInvite(invite_id);

			// Log the user invite deletion
			await AuditLogService.notifyAuditSystem({
				action: "user_invite_deleted",
				org_id: org_id,
				user_id: c.get("user_id"),
				message: `User invite deleted for ${invite.email}.`,
				details: {
					invite_id: invite_id,
					email: invite.email,
					role_id: invite.role_id,
				},
			});

			return c.json({ message: "User invite deleted successfully." }, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getAllUserInvites = async (c: Context) => {
		try {
			const org_id = c.get("org_id");

			const permissions = c.get("permissions");

			// only Admin can get user invites
			if (!permissions.is_admin || !permissions.is_master) {
				return c.json({ error: "Only Admin can view user invites." }, 403);
			}

			const invites = await InviteService.getAllUserInvites(org_id);

			// Log the retrieval of user invites
			await AuditLogService.notifyAuditSystem({
				action: "user_invites_retrieved",
				org_id,
				user_id: c.get("user_id"),
				message: `User invites retrieved.`,
				details: {
					invites_count: invites.length,
				},
			});

			return c.json({ invites }, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};
}

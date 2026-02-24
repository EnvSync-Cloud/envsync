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
import { runSaga } from "@/helpers/saga";
import { DB } from "@/libs/db";

export class OnboardingController {
	public static readonly createOrgInvite = async (c: Context) => {
		const { email } = await c.req.json();

		if (!email) {
			return c.json({ error: "Email is required." }, 400);
		}

		const invite_code = await InviteService.createOrgInvite(email);

		await onOrgOnboardingInvite(email, {
			accept_link: `${config.LANDING_PAGE_URL}/onboarding/accept-org-invite/${invite_code}`,
		});

		return c.json({ message: "Organization invite created successfully." }, 201);
	};

	public static readonly acceptOrgInvite = async (c: Context) => {
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

		const sagaCtx = { org_id: "", admin_role_id: "", user_id: "" };

		await runSaga("acceptOrgInvite", sagaCtx, [
			{
				name: "create-org",
				execute: async (c) => {
					c.org_id = await OrgService.createOrg({
						name,
						slug: slugifyName(name),
						size,
						website,
					});
				},
				compensate: async (c) => {
					const db = await DB.getInstance();
					await db.deleteFrom("orgs").where("id", "=", c.org_id).execute();
				},
			},
			{
				name: "create-default-roles",
				execute: async (c) => {
					const roles = await RoleService.createDefaultRoles(c.org_id);
					c.admin_role_id = roles.find(role => role.name === "Org Admin")?.id || "";
				},
				compensate: async (c) => {
					const db = await DB.getInstance();
					await db.deleteFrom("org_role").where("org_id", "=", c.org_id).execute();
				},
			},
			{
				name: "create-user",
				execute: async (c) => {
					const user = await UserService.createUser({
						email: invite_data.email,
						full_name,
						password,
						org_id: c.org_id,
						role_id: c.admin_role_id,
					});
					c.user_id = user.id;
				},
				compensate: async (c) => {
					await UserService.deleteUser(c.user_id);
				},
			},
			{
				name: "accept-invite",
				execute: async () => {
					await InviteService.updateOrgInvite(invite_data.id, {
						is_accepted: true,
					});
				},
				compensate: async () => {
					await InviteService.updateOrgInvite(invite_data.id, {
						is_accepted: false,
					});
				},
			},
			{
				name: "audit-log",
				execute: async (c) => {
					await AuditLogService.notifyAuditSystem({
						action: "org_created",
						org_id: c.org_id,
						user_id: c.user_id,
						message: `Organization created.`,
						details: {
							name,
						},
					});
				},
			},
		]);

		return c.json({ message: "Organization created successfully." }, 200);
	};

	public static readonly getOrgInviteByCode = async (c: Context) => {
		const { invite_code } = c.req.param();

		if (!invite_code) {
			return c.json({ error: "Invite code is required." }, 400);
		}

		const invite = await InviteService.getOrgInviteByCode(invite_code);

		return c.json({ invite }, 200);
	};

	public static readonly createUserInvite = async (c: Context) => {
		const org_id = c.get("org_id");

		const { email, role_id } = await c.req.json();

		if (!email || !role_id) {
			return c.json({ error: "Email and role ID are required." }, 400);
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
	};

	public static readonly acceptUserInvite = async (c: Context) => {
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
	};

	public static readonly getUserInviteByCode = async (c: Context) => {
		const { invite_code } = c.req.param();

		if (!invite_code) {
			return c.json({ error: "Invite code is required." }, 400);
		}

		const invite = await InviteService.getUserInviteByCode(invite_code);

		return c.json({ invite }, 200);
	};

	// update user invite
	public static readonly updateUserInvite = async (c: Context) => {
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
	};

	public static readonly deleteUserInvite = async (c: Context) => {
		const org_id = c.get("org_id");
		const { invite_id } = c.req.param();

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
	};

	public static readonly getAllUserInvites = async (c: Context) => {
		const org_id = c.get("org_id");

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
	};
}

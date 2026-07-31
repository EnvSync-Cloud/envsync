import { type Context } from "hono";

import { UserService } from "@/services/user.service";
import { OrgService } from "@/services/org.service";
import { RoleService } from "@/services/role.service";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { WorkspaceProvisioningService } from "@/services/workspace-provisioning.service";
import { readAccessToken, setActiveMembershipCookie } from "@/helpers/web-auth";

async function buildSessionPayload(userId: string) {
	const user = await UserService.getUser(userId);
	const [org, role, memberships] = await Promise.all([
		OrgService.getOrg(user.org_id),
		RoleService.getRole(user.role_id),
		user.auth_service_id
			? UserService.listMembershipSummariesByIdpId(user.auth_service_id, user.id)
			: Promise.resolve([
				{
					user_id: user.id,
					org_id: user.org_id,
					org_name: "",
					org_slug: "",
					role_id: user.role_id,
					role_name: "",
					is_admin: false,
					is_master: false,
					is_active: true,
				},
			]),
	]);

	const normalizedMemberships = memberships.length > 0
		? memberships
		: [
			{
				user_id: user.id,
				org_id: org.id,
				org_name: org.name,
				org_slug: org.slug,
				role_id: role.id,
				role_name: role.name,
				is_admin: role.is_admin,
				is_master: role.is_master,
				is_active: true,
			},
		];

	const policy = EditionPolicyService.getPolicySnapshot();

	return {
		user,
		org,
		role,
		memberships: normalizedMemberships.map(membership => ({
			...membership,
			org_name: membership.org_name || org.name,
			org_slug: membership.org_slug || org.slug,
			role_name: membership.role_name || role.name,
			is_admin: membership.role_id === role.id ? role.is_admin : membership.is_admin,
			is_master: membership.role_id === role.id ? role.is_master : membership.is_master,
		})),
		active_membership_user_id: user.id,
		deployment_mode: policy.deployment_mode,
		max_orgs: policy.max_orgs,
		public_signup_enabled: policy.public_signup_enabled,
		can_create_organization: policy.can_create_organization,
	};
}

export class AuthController {
	public static readonly whoami = async (c: Context) => {
		return c.json(await buildSessionPayload(c.get("user_id")));
	};

	public static readonly switchOrg = async (c: Context) => {
		if (!readAccessToken(c)) {
			return c.json({ error: "Cookie session required", code: "AUTH_COOKIE_SESSION_REQUIRED" }, 401);
		}

		const payload = await c.req.json<{ org_id: string }>();
		const currentUser = await UserService.getUser(c.get("user_id"));

		if (!currentUser.auth_service_id) {
			return c.json({ error: "Active session is not backed by an identity provider", code: "AUTH_NO_IDP" }, 400);
		}

		try {
			const user = await UserService.switchActiveMembership(currentUser.auth_service_id, payload.org_id);
			setActiveMembershipCookie(c, user.id);
			return c.json(await buildSessionPayload(user.id));
		} catch (error) {
			return c.json(
				{
					error: error instanceof Error ? error.message : "Membership not found",
					code: "AUTH_ORG_MEMBERSHIP_REQUIRED",
				},
				403,
			);
		}
	};

	/**
	 * Hosted-only org create for dashboard sessions.
	 * Route: POST /auth/create-organization
	 */
	public static readonly createOrganization = async (c: Context) => {
		if (!readAccessToken(c)) {
			return c.json({ error: "Cookie session required", code: "AUTH_COOKIE_SESSION_REQUIRED" }, 401);
		}

		// Hosted-only channel (program plan §1.1a). Self-host never creates orgs via web.
		if (!EditionPolicyService.canCreateOrganizationViaWeb()) {
			return c.json(
				{
					error: "Organization creation is not allowed through the dashboard on this deployment.",
					code: "ORG_CREATE_CHANNEL_FORBIDDEN",
				},
				403,
			);
		}

		const payload = await c.req.json<{ name: string }>();
		const currentUser = await UserService.getUser(c.get("user_id"));

		if (!currentUser.auth_service_id) {
			return c.json({ error: "Active session is not backed by an identity provider", code: "AUTH_NO_IDP" }, 400);
		}

		const result = await WorkspaceProvisioningService.createWorkspaceForExistingIdentity({
			workspaceName: payload.name,
			authServiceId: currentUser.auth_service_id,
			currentUserId: currentUser.id,
			source: "hosted_dashboard",
		});
		setActiveMembershipCookie(c, result.user_id);
		return c.json(await buildSessionPayload(result.user_id));
	};
}

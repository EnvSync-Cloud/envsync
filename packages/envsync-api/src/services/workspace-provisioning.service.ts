import { AppError } from "@/libs/errors";
import { DB } from "@/libs/db";
import { runSaga } from "@/helpers/saga";
import { AuditLogService } from "@/services/audit_log.service";
import { CertificateRoleMapper } from "@/services/certificate-role.mapper";
import { CertificateService } from "@/services/certificate.service";
import { OrgProvisioningService } from "@/services/org-provisioning.service";
import { OrgService } from "@/services/org.service";
import { RoleService } from "@/services/role.service";
import { SystemStateService } from "@/services/system-state.service";
import { UserService } from "@/services/user.service";

function baseSlug(name: string) {
	return name
		.toLowerCase()
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^a-z0-9-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "") || "workspace";
}

async function generateUniqueWorkspaceSlug(name: string) {
	const root = baseSlug(name);

	for (let index = 1; index <= 20; index += 1) {
		const slug = index === 1 ? root : `${root}-${index}`;
		const exists = await OrgService.checkIfSlugExists(slug);
		if (!exists) {
			return slug;
		}
	}

	throw new AppError(
		"Could not generate a unique workspace slug. Try a different name.",
		409,
		"ORG_SLUG_CONFLICT",
	);
}

export class WorkspaceProvisioningService {
	public static async createWorkspaceForExistingIdentity(input: {
		workspaceName: string;
		authServiceId: string;
		currentUserId: string;
		source?: string;
	}) {
		const source = input.source ?? "hosted_dashboard";
		await OrgProvisioningService.assertProvisioningAllowed(source);

		const currentUser = await UserService.getUser(input.currentUserId);
		const slug = await generateUniqueWorkspaceSlug(input.workspaceName);
		const sagaCtx = { org_id: "", admin_role_id: "", user_id: "" };

		await runSaga("createWorkspaceForExistingIdentity", sagaCtx, [
			{
				name: "create-org",
				execute: async (ctx) => {
					ctx.org_id = await OrgService.createOrg({
						name: input.workspaceName,
						slug,
						metadata: SystemStateService.buildProvisioningMetadata(source),
					});
				},
				compensate: async (ctx) => {
					const db = await DB.getInstance();
					await db.deleteFrom("orgs").where("id", "=", ctx.org_id).execute();
				},
			},
			{
				name: "create-default-roles",
				execute: async (ctx) => {
					const roles = await RoleService.createDefaultRoles(ctx.org_id);
					ctx.admin_role_id = roles.find(role => role.name === "Org Admin")?.id || "";
					if (!ctx.admin_role_id) {
						throw new Error("Default Org Admin role was not created");
					}
				},
				compensate: async (ctx) => {
					const db = await DB.getInstance();
					await db.deleteFrom("org_role").where("org_id", "=", ctx.org_id).execute();
				},
			},
			{
				name: "create-membership",
				execute: async (ctx) => {
					const membership = await UserService.createMembershipForExistingIdentity({
						email: currentUser.email,
						full_name: currentUser.full_name || currentUser.email,
						profile_picture_url: currentUser.profile_picture_url,
						auth_service_id: input.authServiceId,
						org_id: ctx.org_id,
						role_id: ctx.admin_role_id,
					});
					ctx.user_id = membership.id;
				},
				compensate: async (ctx) => {
					await UserService.deleteUser(ctx.user_id);
				},
			},
			{
				name: "init-system-ca",
				execute: async (ctx) => {
					await CertificateService.initOrgCA(
						ctx.org_id,
						input.workspaceName,
						ctx.user_id,
						"System-generated organization CA",
						{ issued_source: input.source ?? "workspace_switcher" },
						{ is_system_generated: true },
					);
				},
			},
			{
				name: "issue-system-member-cert",
				execute: async (ctx) => {
					const role = await RoleService.getRole(ctx.admin_role_id);
					await CertificateService.issueMemberCert({
						org_id: ctx.org_id,
						target_user_id: ctx.user_id,
						target_email: currentUser.email,
						issued_by_user_id: ctx.user_id,
						envsync_pki_role: CertificateRoleMapper.toPkiRole(role),
						is_system_generated: true,
						persist_private_key: true,
						description: "System-generated admin certificate",
						metadata: {
							role_id: role.id,
							role_name: role.name,
							issued_source: input.source ?? "workspace_switcher",
						},
					});
				},
			},
			{
				name: "audit-log",
				execute: async (ctx) => {
					await AuditLogService.notifyAuditSystem({
						action: "org_created",
						org_id: ctx.org_id,
						user_id: ctx.user_id,
						message: "Workspace created.",
						details: {
							name: input.workspaceName,
							slug,
							source: input.source ?? "workspace_switcher",
						},
					});
				},
			},
		]);

		return {
			org_id: sagaCtx.org_id,
			admin_role_id: sagaCtx.admin_role_id,
			user_id: sagaCtx.user_id,
		};
	}
}

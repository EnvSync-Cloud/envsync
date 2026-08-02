import { AppError } from "@/libs/errors";
import { DB } from "@/libs/db";
import { runSaga } from "@/helpers/saga";
import { AuditLogService } from "@/services/audit_log.service";
import { CertificateRoleMapper } from "@/services/certificate-role.mapper";
import { CertificateService } from "@/services/certificate.service";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { EntitlementService } from "@/services/entitlement.service";
import { InviteService } from "@/services/invite.service";
import { OrgService } from "@/services/org.service";
import { RoleService } from "@/services/role.service";
import { SystemStateService } from "@/services/system-state.service";
import { UserService } from "@/services/user.service";
import { slugifyName } from "@/utils/random";

export interface ProvisionOrganizationInput {
	org: {
		name: string;
		size?: string;
		website?: string | null;
		slug?: string;
		metadata?: Record<string, unknown>;
	};
	adminUser: {
		email: string;
		full_name: string;
		password: string;
	};
	source: string;
	inviteId?: string;
}

export class OrgProvisioningService {
	public static async assertProvisioningAllowed(source?: string) {
		// Populate entitlement cache so getMaxOrgs can read verified claims (Phase 4).
		await EntitlementService.resolve().catch(() => null);

		const db = await DB.getInstance();
		const countResult = await db
			.selectFrom("orgs")
			.select(({ fn }) => fn.count<string>("id").as("count"))
			.executeTakeFirstOrThrow();
		const orgCount = Number(countResult.count);
		if (source) {
			EditionPolicyService.assertCanProvisionOrg({ source, orgCount });
			return;
		}
		EditionPolicyService.assertOrgProvisioningAllowed(orgCount);
	}

	public static async provisionOrganization(input: ProvisionOrganizationInput) {
		await this.assertProvisioningAllowed(input.source);

		const sagaCtx = { org_id: "", admin_role_id: "", user_id: "" };
		let generatedBundle: {
			root_ca_pem: string;
			member_cert_pem: string;
			member_key_pem: string;
			member_certificate_id: string;
			member_serial_hex: string;
			is_system_generated: true;
		} | undefined;

		try {
			await runSaga("provisionOrganization", sagaCtx, [
				{
					name: "create-org",
					execute: async (ctx) => {
						ctx.org_id = await OrgService.createOrg({
							name: input.org.name,
							slug: input.org.slug ?? slugifyName(input.org.name),
							size: input.org.size,
							website: input.org.website,
							metadata: {
								...SystemStateService.buildProvisioningMetadata(input.source),
								...(input.org.metadata ?? {}),
							},
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
					},
					compensate: async (ctx) => {
						const db = await DB.getInstance();
						await db.deleteFrom("org_role").where("org_id", "=", ctx.org_id).execute();
					},
				},
				{
					name: "create-admin-user",
					execute: async (ctx) => {
						const user = await UserService.createUser({
							email: input.adminUser.email,
							full_name: input.adminUser.full_name,
							password: input.adminUser.password,
							org_id: ctx.org_id,
							role_id: ctx.admin_role_id,
						});
						ctx.user_id = user.id;
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
							input.org.name,
							ctx.user_id,
							"System-generated organization CA",
							{ issued_source: input.source },
							{ is_system_generated: true },
						);
					},
				},
				{
					name: "issue-system-member-cert",
					execute: async (ctx) => {
						const role = await RoleService.getRole(ctx.admin_role_id);
						const cert = await CertificateService.issueMemberCert({
							org_id: ctx.org_id,
							target_user_id: ctx.user_id,
							target_email: input.adminUser.email,
							issued_by_user_id: ctx.user_id,
							envsync_pki_role: CertificateRoleMapper.toPkiRole(role),
							is_system_generated: true,
							persist_private_key: true,
							description: "System-generated admin certificate",
							metadata: {
								role_id: role.id,
								role_name: role.name,
								issued_source: input.source,
							},
						});
						const rootCA = await CertificateService.getRootCA();
						generatedBundle = {
							root_ca_pem: rootCA.cert_pem,
							member_cert_pem: cert.cert_pem ?? "",
							member_key_pem: cert.key_pem,
							member_certificate_id: cert.id,
							member_serial_hex: cert.serial_hex,
							is_system_generated: true,
						};
					},
				},
				{
					name: "accept-invite",
					execute: async () => {
						if (!input.inviteId) {
							return;
						}

						await InviteService.updateOrgInvite(input.inviteId, {
							is_accepted: true,
						});
					},
					compensate: async () => {
						if (!input.inviteId) {
							return;
						}

						await InviteService.updateOrgInvite(input.inviteId, {
							is_accepted: false,
						});
					},
				},
				{
					name: "mark-bootstrap-complete",
					execute: async () => {
						await SystemStateService.markBootstrapCompleted();
					},
				},
				{
					name: "audit-log",
					execute: async (ctx) => {
						await AuditLogService.notifyAuditSystem({
							action: "org_created",
							org_id: ctx.org_id,
							user_id: ctx.user_id,
							message: "Organization created.",
							details: {
								name: input.org.name,
								source: input.source,
							},
						});
					},
				},
			]);
		} catch (error) {
			if (
				error instanceof AppError
				&& (error.code === "CONFLICT" || error.code === "NOT_FOUND")
			) {
				throw new AppError("Organization already onboarded for this email.", 409, "ORG_ALREADY_ONBOARDED");
			}
			if ((error as { code?: string }).code === "23505") {
				throw new AppError("Organization already onboarded for this email.", 409, "ORG_ALREADY_ONBOARDED");
			}
			throw error;
		}

		return {
			org_id: sagaCtx.org_id,
			admin_role_id: sagaCtx.admin_role_id,
			user_id: sagaCtx.user_id,
			generated_certificate_bundle: generatedBundle,
		};
	}
}

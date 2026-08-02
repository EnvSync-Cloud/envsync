import type { Context } from "hono";

import { DB } from "@/libs/db";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { OrgProvisioningService } from "@/services/org-provisioning.service";
import { SystemStateService } from "@/services/system-state.service";
import { isPasswordStrong } from "@/utils/password";

async function getOrgCount() {
	const db = await DB.getInstance();
	const row = await db
		.selectFrom("orgs")
		.select(({ fn }) => fn.count<string>("id").as("count"))
		.executeTakeFirstOrThrow();
	return Number(row.count);
}

export class SetupController {
	public static readonly status = async (c: Context) => {
		const orgCount = await getOrgCount();
		const policy = EditionPolicyService.getPolicySnapshot();
		const maxOrgs = policy.max_orgs ?? 1;
		const canCreate = maxOrgs === null ? true : orgCount < maxOrgs;

		return c.json({
			deployment_mode: policy.deployment_mode,
			edition: policy.edition,
			org_count: orgCount,
			max_orgs: policy.max_orgs,
			can_create_organization: canCreate,
			first_org_ready: orgCount >= 1,
			channel: orgCount === 0 ? "selfhost_bootstrap" : "selfhost_cli",
		});
	};

	public static readonly createOrg = async (c: Context) => {
		const body = await c.req.json<{
			org_name?: string;
			org_slug?: string;
			admin_email?: string;
			admin_full_name?: string;
			admin_password?: string;
		}>();

		const orgName = body.org_name?.trim() ?? "";
		const adminEmail = body.admin_email?.trim() ?? "";
		const adminFullName = body.admin_full_name?.trim() || adminEmail;
		const adminPassword = body.admin_password ?? "";

		if (!orgName || !adminEmail || !adminPassword) {
			return c.json(
				{
					error: "org_name, admin_email, and admin_password are required.",
					code: "SETUP_ORG_INVALID",
				},
				400,
			);
		}

		if (!isPasswordStrong(adminPassword)) {
			return c.json(
				{
					error:
						"Password must be at least 8 characters and contain uppercase, lowercase, number, and special character.",
					code: "SETUP_PASSWORD_WEAK",
				},
				400,
			);
		}

		const orgCount = await getOrgCount();
		const source = orgCount === 0 ? "selfhost_bootstrap" : "selfhost_cli";

		const provisioned = await OrgProvisioningService.provisionOrganization({
			org: {
				name: orgName,
				slug: body.org_slug?.trim() || undefined,
			},
			adminUser: {
				email: adminEmail,
				full_name: adminFullName,
				password: adminPassword,
			},
			source,
		});

		if (orgCount === 0) {
			await SystemStateService.markBootstrapCompleted();
		}

		return c.json(
			{
				message: "Organization created successfully.",
				org_id: provisioned.org_id,
				admin_user_id: provisioned.user_id,
				source,
				first_org: orgCount === 0,
			},
			201,
		);
	};
}

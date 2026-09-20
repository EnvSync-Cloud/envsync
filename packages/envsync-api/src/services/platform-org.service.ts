import { randomBytes } from "node:crypto";

import { AppError, ConflictError, ValidationError } from "@/libs/errors";
import { DB } from "@/libs/db";
import { OrgFeatureGrantService } from "@/services/org-feature-grant.service";
import { OrgProvisioningService } from "@/services/org-provisioning.service";
import { OrganizationProvisioningService } from "@/services/organization-provisioning.service";
import { OrgService } from "@/services/org.service";
import { isPlanId, normalizeOverlayFeatures, type PlanId } from "@/services/plan.catalog";
import { UserService } from "@/services/user.service";

export type PlatformProvisionMode = "existing_identity" | "fresh_tenant";

export type PlatformProvisionInput = {
	mode: PlatformProvisionMode;
	organization_name: string;
	slug?: string;
	plan?: string;
	overlay_features?: string[];
	membership_user_id?: string;
	admin_email?: string;
	admin_full_name?: string;
	actor_email?: string;
};

export type PlatformProvisionResult = {
	org_id: string;
	org_name: string;
	org_slug: string;
	user_id: string;
	auth_service_id: string | null;
	plan: PlanId;
	overlay_features: string[];
	mode: PlatformProvisionMode;
};

function randomBootstrapPassword() {
	return `${randomBytes(24).toString("base64url")}Aa1!`;
}

export class PlatformOrgService {
	public static async provision(input: PlatformProvisionInput): Promise<PlatformProvisionResult> {
		const name = input.organization_name.trim();
		if (!name) {
			throw new ValidationError("organization_name is required", "OPS_ORG_NAME_REQUIRED");
		}
		const plan: PlanId = input.plan && isPlanId(input.plan) ? input.plan : "developer";
		const overlay = normalizeOverlayFeatures(input.overlay_features ?? []);
		const actor = input.actor_email?.trim() || "hosted_ops";

		if (input.mode === "existing_identity") {
			return this.createForExistingIdentity({
				membershipUserId: input.membership_user_id ?? "",
				name,
				plan,
				overlay,
				actor,
			});
		}
		if (input.mode === "fresh_tenant") {
			return this.createFreshTenant({
				name,
				slug: input.slug,
				adminEmail: input.admin_email ?? "",
				adminFullName: input.admin_full_name ?? "",
				plan,
				overlay,
				actor,
			});
		}
		throw new ValidationError("mode must be existing_identity or fresh_tenant", "OPS_BAD_MODE");
	}

	private static async createForExistingIdentity(input: {
		membershipUserId: string;
		name: string;
		plan: PlanId;
		overlay: string[];
		actor: string;
	}): Promise<PlatformProvisionResult> {
		if (!input.membershipUserId) {
			throw new ValidationError("membership_user_id is required", "OPS_USER_REQUIRED");
		}
		const currentUser = await UserService.getUser(input.membershipUserId);
		if (!currentUser.auth_service_id) {
			throw new AppError("User is not backed by an identity provider", 400, "AUTH_NO_IDP");
		}

		const created = await OrganizationProvisioningService.createOrganizationForExistingIdentity({
			organizationName: input.name,
			authServiceId: currentUser.auth_service_id,
			currentUserId: currentUser.id,
			source: "hosted_ops",
		});

		await OrgFeatureGrantService.replaceGrant({
			orgId: created.org_id,
			plan: input.plan,
			overlay_features: input.overlay,
			source: "hosted_ops",
			updatedBy: input.actor,
		});

		const org = await OrgService.getOrg(created.org_id);
		return {
			org_id: created.org_id,
			org_name: org.name,
			org_slug: org.slug,
			user_id: created.user_id,
			auth_service_id: currentUser.auth_service_id,
			plan: input.plan,
			overlay_features: input.overlay,
			mode: "existing_identity",
		};
	}

	private static async createFreshTenant(input: {
		name: string;
		slug?: string;
		adminEmail: string;
		adminFullName: string;
		plan: PlanId;
		overlay: string[];
		actor: string;
	}): Promise<PlatformProvisionResult> {
		const email = input.adminEmail.trim().toLowerCase();
		const fullName = input.adminFullName.trim() || email;
		if (!email) {
			throw new ValidationError("admin_email is required", "OPS_ADMIN_EMAIL_REQUIRED");
		}

		const db = await DB.getInstance();
		const existing = await db
			.selectFrom("users")
			.select(["id", "email"])
			.where("email", "=", email)
			.executeTakeFirst();
		if (existing) {
			throw new ConflictError(
				"A user with this email already exists. Create an organization for that user instead.",
				"USER_EXISTS",
			);
		}

		const created = await OrgProvisioningService.provisionOrganization({
			org: {
				name: input.name,
				slug: input.slug?.trim() || undefined,
			},
			adminUser: {
				email,
				full_name: fullName,
				password: randomBootstrapPassword(),
			},
			source: "hosted_ops",
		});

		await OrgFeatureGrantService.replaceGrant({
			orgId: created.org_id,
			plan: input.plan,
			overlay_features: input.overlay,
			source: "hosted_ops",
			updatedBy: input.actor,
		});

		const [org, membership] = await Promise.all([
			OrgService.getOrg(created.org_id),
			UserService.getUser(created.user_id),
		]);

		return {
			org_id: created.org_id,
			org_name: org.name,
			org_slug: org.slug,
			user_id: created.user_id,
			auth_service_id: membership.auth_service_id,
			plan: input.plan,
			overlay_features: input.overlay,
			mode: "fresh_tenant",
		};
	}
}

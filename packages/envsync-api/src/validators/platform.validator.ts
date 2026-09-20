import z from "zod";
import "zod-openapi/extend";

import { PLAN_IDS } from "@/services/plan.catalog";
import { errorResponseSchema } from "@/validators/common";

export { errorResponseSchema };

export const platformProvisionRequestSchema = z
	.object({
		mode: z.enum(["existing_identity", "fresh_tenant"]),
		organization_name: z.string().trim().min(1).max(120),
		slug: z.string().trim().min(1).max(120).optional(),
		plan: z.enum(PLAN_IDS).optional(),
		overlay_features: z.array(z.string()).optional(),
		membership_user_id: z.string().uuid().optional(),
		admin_email: z.string().email().optional(),
		admin_full_name: z.string().trim().min(1).max(200).optional(),
		actor_email: z.string().email().optional(),
	})
	.openapi({ ref: "PlatformProvisionRequest" });

export const platformProvisionResponseSchema = z
	.object({
		org_id: z.string(),
		org_name: z.string(),
		org_slug: z.string(),
		user_id: z.string(),
		auth_service_id: z.string().nullable(),
		plan: z.enum(PLAN_IDS),
		overlay_features: z.array(z.string()),
		mode: z.enum(["existing_identity", "fresh_tenant"]),
	})
	.openapi({ ref: "PlatformProvisionResponse" });

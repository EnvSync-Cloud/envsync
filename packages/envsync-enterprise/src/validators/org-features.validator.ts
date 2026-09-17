import z from "zod";

import "zod-openapi/extend";

export const orgFeatureGrantParamSchema = z
	.object({
		orgId: z.string().min(1).openapi({ example: "org_123" }),
	})
	.openapi({ ref: "OrgFeatureGrantParam" });

export const putOrgFeatureGrantRequestSchema = z
	.object({
		plan: z.enum(["developer", "plus", "enterprise"]).optional().openapi({ example: "plus" }),
		features: z.array(z.string()).optional().openapi({
			example: ["saml", "kms"],
			minItems: 0,
		}),
		source: z.enum(["billing", "support", "seed"]).optional().openapi({ example: "billing" }),
		updated_by: z.string().min(1).optional().openapi({ example: "platform" }),
	})
	.refine(value => value.plan !== undefined || value.features !== undefined, {
		message: "plan or features is required",
	})
	.openapi({ ref: "PutOrgFeatureGrantRequest" });

export const orgFeatureGrantResponseSchema = z
	.object({
		org_id: z.string().openapi({ example: "org_123" }),
		unrestricted: z.boolean().openapi({ example: false }),
		plan: z.string().optional().openapi({ example: "plus" }),
		features: z.array(z.string()).openapi({ example: ["saml", "kms"] }),
		source: z.string().nullable().openapi({ example: "billing" }),
		updated_by: z.string().nullable().openapi({ example: null }),
		created_at: z.string().nullable().openapi({ example: "2026-09-13T00:00:00.000Z" }),
		updated_at: z.string().nullable().openapi({ example: "2026-09-13T00:00:00.000Z" }),
	})
	.openapi({ ref: "OrgFeatureGrantResponse" });

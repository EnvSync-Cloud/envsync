import z from "zod";

import "zod-openapi/extend";

export const orgFeatureGrantParamSchema = z
	.object({
		orgId: z.string().min(1).openapi({ example: "org_123" }),
	})
	.openapi({ ref: "OrgFeatureGrantParam" });

export const putOrgFeatureGrantRequestSchema = z
	.object({
		// Empty [] is a closed set (no EE features). Fern Go tags this field
		// omitempty, so PUT [] must go through the CLI / TS SDK / raw HTTP.
		features: z.array(z.string()).openapi({
			example: ["saml", "kms"],
			minItems: 0,
		}),
		source: z.enum(["billing", "support", "seed"]).optional().openapi({ example: "billing" }),
		updated_by: z.string().min(1).optional().openapi({ example: "platform" }),
	})
	.openapi({ ref: "PutOrgFeatureGrantRequest" });

export const orgFeatureGrantResponseSchema = z
	.object({
		org_id: z.string().openapi({ example: "org_123" }),
		unrestricted: z.boolean().openapi({ example: false }),
		features: z.array(z.string()).openapi({ example: ["saml", "kms"] }),
		source: z.string().nullable().openapi({ example: "billing" }),
		updated_by: z.string().nullable().openapi({ example: null }),
		created_at: z.string().nullable().openapi({ example: "2026-09-13T00:00:00.000Z" }),
		updated_at: z.string().nullable().openapi({ example: "2026-09-13T00:00:00.000Z" }),
	})
	.openapi({ ref: "OrgFeatureGrantResponse" });

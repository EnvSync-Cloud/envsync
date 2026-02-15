import z from "zod";
import "zod-openapi/extend";

export const updateOrgRequestSchema = z
	.object({
		logo_url: z.string().url().optional().openapi({ example: "https://example.com/logo.png" }),
		website: z.string().url().optional().openapi({ example: "https://example.com" }),
		name: z.string().optional().openapi({ example: "Updated Organization Name" }),
		slug: z.string().optional().openapi({ example: "updated-org-name" }),
	})
	.openapi({ ref: "UpdateOrgRequest" });

export const orgResponseSchema = z
	.object({
		id: z.string().openapi({ example: "org_123" }),
		name: z.string().openapi({ example: "My Organization" }),
		logo_url: z.string().nullable().openapi({ example: "https://example.com/logo.png" }),
		slug: z.string().openapi({ example: "my-organization" }),
		size: z.string().nullable().openapi({ example: "small" }),
		website: z.string().nullable().openapi({ example: "https://example.com" }),
		metadata: z.record(z.any()).openapi({ example: { industry: "technology" } }),
		created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "OrgResponse" });

export const checkSlugResponseSchema = z
	.object({
		exists: z.boolean().openapi({ example: true }),
	})
	.openapi({ ref: "CheckSlugResponse" });

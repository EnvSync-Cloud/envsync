import z from "zod";
import "zod-openapi/extend";
import { roleResponseSchema } from "./role.validator";

export const membershipSummarySchema = z.object({
	user_id: z.string().openapi({ example: "user_123" }),
	org_id: z.string().openapi({ example: "org_123" }),
	org_name: z.string().openapi({ example: "My Organization" }),
	org_slug: z.string().openapi({ example: "my-organization" }),
	role_id: z.string().openapi({ example: "role_123" }),
	role_name: z.string().openapi({ example: "Org Admin" }),
	is_admin: z.boolean().openapi({ example: true }),
	is_master: z.boolean().openapi({ example: true }),
	is_active: z.boolean().openapi({ example: true }),
});

export const switchOrgRequestSchema = z.object({
	org_id: z.string().openapi({ example: "org_123" }),
});

/** Preferred name (Phase 6). createWorkspaceRequestSchema is a deprecated alias. */
export const createOrganizationRequestSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Organization name is required")
		.max(120, "Organization name must be 120 characters or fewer")
		.openapi({ example: "Acme Platform" }),
});

/** @deprecated Use createOrganizationRequestSchema */
export const createWorkspaceRequestSchema = createOrganizationRequestSchema;

export const whoAmIResponseSchema = z
	.object({
		user: z.object({
			id: z.string().openapi({ example: "user_123" }),
			email: z.string().openapi({ example: "user@example.com" }),
			full_name: z.string().openapi({ example: "John Doe" }),
			org_id: z.string().openapi({ example: "org_123" }),
			role_id: z.string().openapi({ example: "role_123" }),
			profile_picture_url: z
				.string()
				.nullable()
				.openapi({ example: "https://example.com/avatar.jpg" }),
			is_active: z.boolean().openapi({ example: true }),
			created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
			updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		}),
		org: z.object({
			id: z.string().openapi({ example: "org_123" }),
			name: z.string().openapi({ example: "My Organization" }),
			logo_url: z.string().nullable().openapi({ example: "https://example.com/logo.png" }),
			slug: z.string().openapi({ example: "my-organization" }),
			size: z.string().nullable().openapi({ example: "small" }),
			website: z.string().nullable().openapi({ example: "https://example.com" }),
			metadata: z.record(z.any()).openapi({ example: { industry: "technology" } }),
			created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
			updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		}),
		role: roleResponseSchema,
		memberships: z.array(membershipSummarySchema),
		active_membership_user_id: z.string().openapi({ example: "user_123" }),
	})
	.openapi({ ref: "WhoAmIResponse" });

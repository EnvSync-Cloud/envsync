import z from "zod";
import "zod-openapi/extend";

const permissionsSchema = z
	.object({
		read: z.boolean().openapi({ example: true }),
		write: z.boolean().openapi({ example: false }),
	})
	.openapi({ ref: "ServiceTokenPermissions" });

export const createServiceTokenRequestSchema = z
	.object({
		name: z.string().min(1).max(255).openapi({ example: "CI/CD Pipeline Token" }),
		app_id: z.string().uuid().optional().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
		env_type_id: z.string().uuid().optional().openapi({ example: "550e8400-e29b-41d4-a716-446655440001" }),
		permissions: permissionsSchema.optional(),
		expires_in_days: z.number().int().min(1).max(365).default(90).openapi({ example: 90 }),
	})
	.openapi({ ref: "CreateServiceTokenRequest" });

export const serviceTokenResponseSchema = z
	.object({
		id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440002" }),
		name: z.string().openapi({ example: "CI/CD Pipeline Token" }),
		app_id: z.string().nullable().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
		env_type_id: z.string().nullable().openapi({ example: "550e8400-e29b-41d4-a716-446655440001" }),
		permissions: permissionsSchema,
		expires_at: z.string().openapi({ example: "2025-04-01T00:00:00Z" }),
		last_used_at: z.string().nullable().openapi({ example: "2025-01-15T10:30:00Z" }),
		created_at: z.string().openapi({ example: "2025-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "ServiceTokenResponse" });

export const createServiceTokenResponseSchema = z
	.object({
		id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440002" }),
		token: z.string().openapi({ example: "esv_550e8400-e29b-41d4-a716-446655440002" }),
		name: z.string().openapi({ example: "CI/CD Pipeline Token" }),
		app_id: z.string().nullable().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
		env_type_id: z.string().nullable().openapi({ example: "550e8400-e29b-41d4-a716-446655440001" }),
		permissions: permissionsSchema,
		expires_at: z.string().openapi({ example: "2025-04-01T00:00:00Z" }),
		created_at: z.string().openapi({ example: "2025-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "CreateServiceTokenResponse" });

export const serviceTokensResponseSchema = z
	.array(serviceTokenResponseSchema)
	.openapi({ ref: "ServiceTokensResponse" });

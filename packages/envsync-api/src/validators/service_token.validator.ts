import z from "zod";
import "zod-openapi/extend";

const permissionsSchema = z
	.object({
		read: z.boolean().openapi({ example: true }),
		write: z.boolean().openapi({ example: false }),
	})
	.openapi({ ref: "ServiceTokenPermissions" });

export const serviceTokenScopeSchema = z
	.object({
		env_type_id: z.string().uuid().nullable().optional().openapi({
			example: "550e8400-e29b-41d4-a716-446655440001",
		}),
		path: z
			.string()
			.min(1)
			.default("/")
			.openapi({ example: "/", description: "Key prefix (not a folder). `/db` matches `db` and `db/host`, not `dbx`." }),
	})
	.openapi({ ref: "ServiceTokenScope" });

export const createServiceTokenRequestSchema = z
	.object({
		name: z.string().min(1).max(255).openapi({ example: "CI/CD Pipeline Token" }),
		app_id: z.string().uuid().optional().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
		env_type_id: z.string().uuid().optional().openapi({ example: "550e8400-e29b-41d4-a716-446655440001" }),
		permissions: permissionsSchema.optional(),
		scopes: z.array(serviceTokenScopeSchema).min(1).optional(),
		expires_in_days: z.number().int().min(1).max(365).default(90).openapi({ example: 90 }),
	})
	.openapi({ ref: "CreateServiceTokenRequest" });

export const rotateServiceTokenRequestSchema = z
	.object({
		grace_hours: z.number().int().min(0).max(168).default(24).openapi({ example: 24 }),
	})
	.openapi({ ref: "RotateServiceTokenRequest" });

export const serviceTokenResponseSchema = z
	.object({
		id: z.string().openapi({ example: "550e8400-e29b-41d4-a716-446655440002" }),
		name: z.string().openapi({ example: "CI/CD Pipeline Token" }),
		app_id: z.string().nullable().openapi({ example: "550e8400-e29b-41d4-a716-446655440000" }),
		env_type_id: z.string().nullable().openapi({ example: "550e8400-e29b-41d4-a716-446655440001" }),
		permissions: permissionsSchema,
		scopes: z.array(serviceTokenScopeSchema),
		rotated_from_id: z.string().nullable().openapi({ example: null }),
		grace_until: z.string().nullable().openapi({ example: null }),
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
		scopes: z.array(serviceTokenScopeSchema),
		rotated_from_id: z.string().nullable().openapi({ example: null }),
		expires_at: z.string().openapi({ example: "2025-04-01T00:00:00Z" }),
		created_at: z.string().openapi({ example: "2025-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "CreateServiceTokenResponse" });

export const rotateServiceTokenResponseSchema = createServiceTokenResponseSchema.openapi({
	ref: "RotateServiceTokenResponse",
});

export const serviceTokensResponseSchema = z
	.array(serviceTokenResponseSchema)
	.openapi({ ref: "ServiceTokensResponse" });

export const listServiceTokensQuerySchema = z
	.object({
		page: z.coerce.number().int().min(1).optional().openapi({ example: 1 }),
		per_page: z.coerce.number().int().min(1).max(100).optional().openapi({ example: 50 }),
		app_id: z.string().uuid().optional().openapi({
			example: "550e8400-e29b-41d4-a716-446655440000",
			description: "Return tokens for this project only",
		}),
	})
	.openapi({ ref: "ListServiceTokensQuery" });

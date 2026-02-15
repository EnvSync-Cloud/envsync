import z from "zod";
import "zod-openapi/extend";

export const createApiKeyRequestSchema = z
	.object({
		name: z.string().openapi({ example: "Production API Key" }),
		description: z.string().optional().openapi({ example: "API key for production environment" }),
	})
	.openapi({ ref: "CreateApiKeyRequest" });

export const apiKeyResponseSchema = z
	.object({
		id: z.string().openapi({ example: "api_key_123" }),
		user_id: z.string().openapi({ example: "user_123" }),
		org_id: z.string().openapi({ example: "org_123" }),
		description: z.string().openapi({ example: "Production API Key" }),
		is_active: z.boolean().openapi({ example: true }),
		key: z.string().openapi({ example: "eVs_xxxxx" }),
		created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		last_used_at: z.string().nullable().openapi({ example: "2023-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "ApiKeyResponse" });

export const apiKeysResponseSchema = z
	.array(apiKeyResponseSchema)
	.openapi({ ref: "ApiKeysResponse" });

export const updateApiKeyRequestSchema = z
	.object({
		description: z.string().optional().openapi({ example: "Updated API key description" }),
		is_active: z.boolean().optional().openapi({ example: false }),
		last_used_at: z.string().optional().openapi({ example: "2023-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "UpdateApiKeyRequest" });

export const regenerateApiKeyResponseSchema = z
	.object({
		newKey: z.string().openapi({ example: "eVs_newkey_xxxxx" }),
		id: z.string().openapi({ example: "api_key_123" }),
	})
	.openapi({ ref: "RegenerateApiKeyResponse" });

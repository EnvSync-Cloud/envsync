import z from "zod";
import "zod-openapi/extend";

export const createEnvTypeRequestSchema = z
	.object({
		name: z.string().openapi({ example: "Production" }),
		color: z.string().optional().openapi({ example: "#ff5733" }),
		is_default: z.boolean().optional().openapi({ example: false }),
		is_protected: z.boolean().optional().openapi({ example: false }),
		app_id: z.string().openapi({ example: "app_123" }),
	})
	.openapi({ ref: "CreateEnvTypeRequest" });

export const updateEnvTypeRequestSchema = z
	.object({
		id: z.string().openapi({ example: "env_type_123" }),
		name: z.string().openapi({ example: "Staging" }),
		color: z.string().optional().openapi({ example: "#ff5733" }),
		is_default: z.boolean().optional().openapi({ example: true }),
		is_protected: z.boolean().optional().openapi({ example: false }),
	})
	.openapi({ ref: "UpdateEnvTypeRequest" });

export const envTypeResponseSchema = z
	.object({
		id: z.string().openapi({ example: "env_type_123" }),
		name: z.string().openapi({ example: "Production" }),
		org_id: z.string().openapi({ example: "org_123" }),
		app_id: z.string().openapi({ example: "app_123" }),
		color: z.string().openapi({ example: "#ff5733" }),
		is_default: z.boolean().openapi({ example: true }),
		is_protected: z.boolean().openapi({ example: false }),
		created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "EnvTypeResponse" });

export const envTypesResponseSchema = z
	.array(envTypeResponseSchema)
	.openapi({ ref: "EnvTypesResponse" });

export const deleteEnvTypeRequestSchema = z
	.object({
		id: z.string().openapi({ example: "env_type_123" }),
	})
	.openapi({ ref: "DeleteEnvTypeRequest" });

import z from "zod";
import "zod-openapi/extend";

export const createAppRequestBodySchema = z
	.object({
		name: z.string().openapi({ example: "My Application" }),
		description: z.string().openapi({ example: "Description of my application" }),
		enable_secrets: z.boolean().optional().openapi({ example: false }),
		public_key: z
			.string()
			.optional()
			.openapi({ example: "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----" }),
		metadata: z
			.record(z.any())
			.optional()
			.openapi({ example: { key: "value" } }),
	})
	.openapi({ ref: "CreateAppRequest" });

export const createAppResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Application created successfully" }),
		id: z.string().openapi({ example: "app_123" }),
	})
	.openapi({ ref: "CreateAppResponse" });

export const getAppResponseSchema = z
	.object({
		id: z.string().openapi({ example: "app_123" }),
		name: z.string().openapi({ example: "My Application" }),
		description: z.string().openapi({ example: "Description of my application" }),
		metadata: z.record(z.any()).openapi({ example: { key: "value" } }),
		enable_secrets: z.boolean().openapi({ example: false }),
		is_managed_secret: z.boolean().openapi({ example: false }),
		public_key: z
			.string()
			.optional()
			.openapi({ example: "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----" }),
		org_id: z.string().openapi({ example: "org_123" }),
		envCount: z.number().openapi({ example: 5 }),
		secretCount: z.number().openapi({ example: 10 }),
		env_types: z
			.array(
				z.object({
					id: z.string().openapi({ example: "env_type_123" }),
					name: z.string().openapi({ example: "Production" }),
					is_default: z.boolean().openapi({ example: true }),
					is_protected: z.boolean().openapi({ example: false }),
					color: z.string().openapi({ example: "#ff0000" }),
				}),
			)
			.openapi({
				example: [
					{
						id: "env_type_123",
						name: "Production",
						is_default: true,
						is_protected: false,
						color: "#ff0000",
					},
				],
			}),
		created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "GetAppResponse" });

export const getAppsResponseSchema = z
	.array(
		z.object({
			id: z.string().openapi({ example: "app_123" }),
			name: z.string().openapi({ example: "My Application" }),
			description: z.string().openapi({ example: "Description of my application" }),
			enable_secrets: z.boolean().openapi({ example: false }),
			is_managed_secret: z.boolean().openapi({ example: false }),
			public_key: z
				.string()
				.optional()
				.openapi({ example: "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----" }),
			metadata: z.record(z.any()).openapi({ example: { key: "value" } }),
			org_id: z.string().openapi({ example: "org_123" }),
			envCount: z.number().openapi({ example: 5 }),
			secretCount: z.number().openapi({ example: 10 }),
			env_types: z
				.array(
					z.object({
						id: z.string().openapi({ example: "env_type_123" }),
						name: z.string().openapi({ example: "Production" }),
						is_default: z.boolean().openapi({ example: true }),
						is_protected: z.boolean().openapi({ example: false }),
						color: z.string().openapi({ example: "#ff0000" }),
					}),
				)
				.openapi({
					example: [
						{
							id: "env_type_123",
							name: "Production",
							is_default: true,
							is_protected: false,
							color: "#ff0000",
						},
					],
				}),
			created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
			updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		}),
	)
	.openapi({ ref: "GetAppsResponse" });

export const updateAppRequestBodySchema = z
	.object({
		name: z.string().optional().openapi({ example: "Updated Application Name" }),
		description: z.string().optional().openapi({ example: "Updated description" }),
		metadata: z
			.record(z.any())
			.optional()
			.openapi({ example: { key: "new_value" } }),
	})
	.openapi({ ref: "UpdateAppRequest" });

export const updateAppResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Application updated successfully" }),
	})
	.openapi({ ref: "UpdateAppResponse" });

export const deleteAppResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Application deleted successfully" }),
	})
	.openapi({ ref: "DeleteAppResponse" });

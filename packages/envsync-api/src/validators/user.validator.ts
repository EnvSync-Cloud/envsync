import z from "zod";
import "zod-openapi/extend";

export const userResponseSchema = z
	.object({
		id: z.string().openapi({ example: "user_123" }),
		email: z.string().email().openapi({ example: "user@example.com" }),
		full_name: z.string().openapi({ example: "John Doe" }),
		profile_picture_url: z
			.string()
			.nullable()
			.openapi({ example: "https://example.com/avatar.jpg" }),
		org_id: z.string().openapi({ example: "org_123" }),
		role_id: z.string().openapi({ example: "role_123" }),
		auth_service_id: z.string().nullable().openapi({ example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" }),
		is_active: z.boolean().openapi({ example: true }),
		created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "UserResponse" });

export const usersResponseSchema = z.array(userResponseSchema).openapi({ ref: "UsersResponse" });

export const updateUserRequestSchema = z
	.object({
		full_name: z.string().optional().openapi({ example: "John Smith" }),
		profile_picture_url: z
			.string()
			.url()
			.optional()
			.openapi({ example: "https://example.com/new-avatar.jpg" }),
		email: z.string().email().optional().openapi({ example: "john.smith@example.com" }),
	})
	.openapi({ ref: "UpdateUserRequest" });

export const updateRoleRequestSchema = z
	.object({
		role_id: z.string().openapi({ example: "role_123" }),
	})
	.openapi({ ref: "UpdateRoleRequest" });

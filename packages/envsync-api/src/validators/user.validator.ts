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
		first_name: z.string().optional().openapi({ example: "John" }),
		last_name: z.string().optional().openapi({ example: "Smith" }),
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

export const accountSecurityResponseSchema = z
	.object({
		first_name: z.string().openapi({ example: "Ada" }),
		last_name: z.string().openapi({ example: "Lovelace" }),
		email: z.string().email().openapi({ example: "ada@example.com" }),
		has_password: z.boolean().openapi({ example: true }),
		mfa_enabled: z.boolean().openapi({ example: false }),
		sign_in_methods: z
			.array(
				z.object({
					id: z.string().openapi({ example: "password" }),
					name: z.string().openapi({ example: "Password" }),
					linked: z.boolean().openapi({ example: true }),
				}),
			)
			.openapi({ example: [{ id: "password", name: "Password", linked: true }] }),
	})
	.openapi({ ref: "AccountSecurityResponse" });

export const setOwnPasswordRequestSchema = z
	.object({
		password: z.string().min(8).max(128).openapi({ example: "a-new-password" }),
	})
	.openapi({ ref: "SetOwnPasswordRequest" });

export const disableMfaRequestSchema = z
	.object({
		password: z.string().min(1).max(128).openapi({ example: "current-password" }),
	})
	.openapi({ ref: "DisableMfaRequest" });

export const confirmMfaRequestSchema = z
	.object({
		code: z
			.string()
			.regex(/^[0-9]{6,8}$/)
			.openapi({ example: "123456" }),
	})
	.openapi({ ref: "ConfirmMfaRequest" });

export const mfaSetupResponseSchema = z
	.object({
		otpauth_url: z.string().openapi({ example: "otpauth://totp/EnvSync:ada?secret=ABC&issuer=EnvSync" }),
		qr_image: z.string().openapi({ example: "data:image/png;base64,..." }),
		secret: z.string().openapi({ example: "ABC" }),
	})
	.openapi({ ref: "MfaSetupResponse" });

export const accountMessageResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Password set." }),
	})
	.openapi({ ref: "AccountMessageResponse" });

import z from "zod";

// For extending the Zod schema with OpenAPI properties
import "zod-openapi/extend";

export const createOrgInviteRequestBodySchema = z
	.object({
		email: z.string().openapi({ example: "user@example.com" }),
	})
	.openapi({ ref: "CreateOrgInviteRequest" });

export const createOrgInviteResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Organization invite created successfully." }),
	})
	.openapi({ ref: "CreateOrgInviteResponse" });

export const acceptOrgInviteRequestBodySchema = z
	.object({
		org_data: z.object({
			name: z.string().openapi({ example: "My Organization" }),
			size: z.string().openapi({ example: "small" }),
			website: z.string().url().openapi({ example: "https://example.com" }),
		}),
		user_data: z.object({
			full_name: z.string().min(1, "Full name is required").openapi({ example: "John Doe" }),
			password: z.string().openapi({ example: "securepassword123" }),
		}),
	})
	.openapi({ ref: "AcceptOrgInviteRequest" });

export const acceptOrgInviteResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Organization created successfully." }),
	})
	.openapi({ ref: "AcceptOrgInviteResponse" });

export const getOrgInviteByCodeResponseSchema = z
	.object({
		invite: z.object({
			id: z.string().openapi({ example: "INVITE_ID" }),
			email: z.string().openapi({ example: "user@example.com" }),
			invite_token: z.string().openapi({ example: "INVITE_TOKEN" }),
			is_accepted: z.boolean().openapi({ example: false }),
			created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
			updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		}),
	})
	.openapi({ ref: "GetOrgInviteByCodeResponse" });

export const createUserInviteRequestBodySchema = z
	.object({
		email: z.string().email().openapi({ example: "abc@example.com" }),
		role_id: z.string().openapi({ example: "ROLE_ID" }),
	})
	.openapi({ ref: "CreateUserInviteRequest" });

export const createUserInviteResponseSchema = z
	.object({
		message: z.string().openapi({ example: "User invite created successfully." }),
	})
	.openapi({ ref: "CreateUserInviteResponse" });

export const acceptUserInviteRequestBodySchema = z
	.object({
		full_name: z.string().min(1, "Full name is required").openapi({ example: "John Doe" }),
		password: z.string().openapi({ example: "securepassword123" }),
	})
	.openapi({ ref: "AcceptUserInviteRequest" });

export const acceptUserInviteResponseSchema = z
	.object({
		message: z.string().openapi({ example: "User invite accepted successfully." }),
	})
	.openapi({ ref: "AcceptUserInviteResponse" });

export const getUserInviteByTokenResponseSchema = z
	.object({
		invite: z.object({
			id: z.string().openapi({ example: "INVITE_ID" }),
			email: z.string().openapi({ example: "abc@example.com" }),
			invite_token: z.string().openapi({ example: "INVITE_TOKEN" }),
			role_id: z.string().openapi({ example: "ROLE_ID" }),
			org_id: z.string().openapi({ example: "ORG_ID" }),
			is_accepted: z.boolean().openapi({ example: false }),
			created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
			updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		}),
	})
	.openapi({ ref: "GetUserInviteByTokenResponse" });

export const updateUserInviteRequestBodySchema = z
	.object({
		role_id: z.string().openapi({ example: "ROLE_ID" }),
	})
	.openapi({ ref: "UpdateUserInviteRequest" });

export const updateUserInviteResponseSchema = z
	.object({
		message: z.string().openapi({ example: "User invite updated successfully." }),
	})
	.openapi({ ref: "UpdateUserInviteResponse" });

export const deleteUserInviteResponseSchema = z
	.object({
		message: z.string().openapi({ example: "User invite deleted successfully." }),
	})
	.openapi({ ref: "DeleteUserInviteResponse" });

export const getAllUserInvitesResponseSchema = z
	.object({
		invites: z.array(
			z.object({
				id: z.string().openapi({ example: "INVITE_ID" }),
				org_id: z.string().openapi({ example: "ORG_ID" }),
				created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
				updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
				email: z.string().email().openapi({ example: "user@example.com" }),
				invite_token: z.string().openapi({ example: "INVITE_TOKEN" }),
				is_accepted: z.boolean().openapi({ example: false }),
				role_id: z.string().openapi({ example: "ROLE_ID" }),
			}),
		),
	})
	.openapi({ ref: "GetAllUserInvitesResponse" });

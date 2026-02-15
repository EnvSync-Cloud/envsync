import z from "zod";
import "zod-openapi/extend";

export const createTeamRequestBodySchema = z
	.object({
		name: z.string().openapi({ example: "Backend Team" }),
		description: z.string().optional().openapi({ example: "Team for backend developers" }),
		color: z.string().optional().openapi({ example: "#3357FF" }),
	})
	.openapi({ ref: "CreateTeamRequest" });

export const createTeamResponseSchema = z
	.object({
		id: z.string().openapi({ example: "team_123" }),
		name: z.string().openapi({ example: "Backend Team" }),
		org_id: z.string().openapi({ example: "org_123" }),
		description: z.string().nullable().openapi({ example: "Team for backend developers" }),
		color: z.string().openapi({ example: "#3357FF" }),
		created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "CreateTeamResponse" });

export const getTeamResponseSchema = z
	.object({
		id: z.string().openapi({ example: "team_123" }),
		name: z.string().openapi({ example: "Backend Team" }),
		org_id: z.string().openapi({ example: "org_123" }),
		description: z.string().nullable().openapi({ example: "Team for backend developers" }),
		color: z.string().openapi({ example: "#3357FF" }),
		created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		members: z
			.array(
				z.object({
					id: z.string(),
					user_id: z.string(),
					created_at: z.string(),
					full_name: z.string().nullable(),
					email: z.string(),
					profile_picture_url: z.string().nullable(),
				}),
			)
			.openapi({ example: [] }),
	})
	.openapi({ ref: "GetTeamResponse" });

export const getTeamsResponseSchema = z
	.array(
		z.object({
			id: z.string().openapi({ example: "team_123" }),
			name: z.string().openapi({ example: "Backend Team" }),
			org_id: z.string().openapi({ example: "org_123" }),
			description: z.string().nullable().openapi({ example: "Team for backend developers" }),
			color: z.string().openapi({ example: "#3357FF" }),
			created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
			updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		}),
	)
	.openapi({ ref: "GetTeamsResponse" });

export const updateTeamRequestBodySchema = z
	.object({
		name: z.string().optional().openapi({ example: "Updated Team Name" }),
		description: z.string().optional().openapi({ example: "Updated description" }),
		color: z.string().optional().openapi({ example: "#FF5733" }),
	})
	.openapi({ ref: "UpdateTeamRequest" });

export const addTeamMemberRequestBodySchema = z
	.object({
		user_id: z.string().openapi({ example: "user_123" }),
	})
	.openapi({ ref: "AddTeamMemberRequest" });

export const messageResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Operation completed successfully" }),
	})
	.openapi({ ref: "TeamMessageResponse" });

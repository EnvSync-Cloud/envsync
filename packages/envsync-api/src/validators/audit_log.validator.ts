import { ActionCategories, ActionPastTimeOptions } from "@/services/audit_log.service";
import z from "zod";
import "zod-openapi/extend";

export const getAuditLogsQuerySchema = z.object({
	page: z.string().default("1").openapi({ example: "1" }),
	per_page: z.string().default("20").refine((val) => {
		const num = Number(val);
		return Number.isInteger(num) && num >= 1 && num <= 100;
	}, { message: "per_page must be an integer between 1 and 100" }).openapi({ example: "20" }),
	filter_by_user: z.string().optional().openapi({ example: "user_123" }),
	filter_by_category: ActionCategories
		.optional()
		.openapi({
			example: "app*",
			description: "Filter by action category, e.g., 'app*', 'env*'",
		}),
	filter_by_past_time: ActionPastTimeOptions
		.optional()
		.openapi({
			example: "last_30_days",
			description: "Filter by past time, e.g., 'last_3_hours', 'last_24_hours', 'last_7_days', 'last_30_days', 'last_90_days', 'last_180_days', 'last_1_year', 'all_time'",
		}),
});

export const getAuditLogsSchema = z
	.array(
		z.object({
			id: z.string().openapi({ example: "audit_123" }),
			action: z.string().openapi({ example: "user_invite_created" }),
			org_id: z.string().openapi({ example: "org_123" }),
			user_id: z.string().openapi({ example: "user_123" }),
			details: z.string().openapi({
				example: JSON.stringify({
					invite_id: "invite_123",
					email: "user@example.com",
					role_id: "role_123",
				}),
			}),
			message: z.string().openapi({
				example: "User invite created for user@example.com",
			}),
			created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
			updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		}),
	)
	.openapi({ ref: "GetAuditLogsResponse" });

export const getAuditLogsResponseSchema = z
	.object({
		auditLogs: getAuditLogsSchema,
		totalPages: z.number().openapi({ example: 5 }),
	})
	.openapi({
		ref: "GetAuditLogsResponseWrapper",
		description: "Response schema for getting audit logs",
		example: {
			auditLogs: [
				{
					id: "audit_123",
					action: "user_invite_created",
					org_id: "org_123",
					user_id: "user_123",
					details: JSON.stringify({
						invite_id: "invite_123",
						email: "user@example.com",
						role_id: "role_123",
					}),
					message: "User invite created for user@example.com",
					created_at: "2023-01-01T00:00:00Z",
					updated_at: "2023-01-01T00:00:00Z",
				},
			],
			totalPages: 5,
		},
	});

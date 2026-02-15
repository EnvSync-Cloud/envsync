import { color } from "bun";
import z from "zod";
import "zod-openapi/extend";

export const createRoleRequestSchema = z
	.object({
		name: z.string().openapi({ example: "Developer" }),
		can_edit: z.boolean().openapi({ example: true }),
		can_view: z.boolean().openapi({ example: true }),
		have_api_access: z.boolean().openapi({ example: false }),
		have_billing_options: z.boolean().openapi({ example: false }),
		have_webhook_access: z.boolean().openapi({ example: false }),
		is_admin: z.boolean().openapi({ example: false }),
		color: z.string().optional().openapi({ example: "#FF5733" }),
	})
	.openapi({ ref: "CreateRoleRequest" });

export const roleResponseSchema = z
	.object({
		id: z.string().openapi({ example: "role_123" }),
		name: z.string().openapi({ example: "Developer" }),
		org_id: z.string().openapi({ example: "org_123" }),
		can_edit: z.boolean().openapi({ example: true }),
		can_view: z.boolean().openapi({ example: true }),
		have_api_access: z.boolean().openapi({ example: false }),
		have_billing_options: z.boolean().openapi({ example: false }),
		have_webhook_access: z.boolean().openapi({ example: false }),
		color: z.string().optional().openapi({ example: "#FF5733" }),
		is_admin: z.boolean().openapi({ example: false }),
		is_master: z.boolean().openapi({ example: false }),
		created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "RoleResponse" });

export const rolesResponseSchema = z.array(roleResponseSchema).openapi({ ref: "RolesResponse" });

export const updateRoleRequestSchema = z
	.object({
		name: z.string().optional().openapi({ example: "Senior Developer" }),
		can_edit: z.boolean().optional().openapi({ example: true }),
		can_view: z.boolean().optional().openapi({ example: true }),
		have_api_access: z.boolean().optional().openapi({ example: true }),
		have_billing_options: z.boolean().optional().openapi({ example: false }),
		have_webhook_access: z.boolean().optional().openapi({ example: true }),
		is_admin: z.boolean().optional().openapi({ example: false }),
		color: z.string().optional().openapi({ example: "#FF5733" }),
	})
	.openapi({ ref: "UpdateRoleRequest" });

export const roleStatsResponseSchema = z
	.object({
		admin_access_count: z.number().openapi({ example: 2 }),
		billing_access_count: z.number().openapi({ example: 3 }),
		api_access_count: z.number().openapi({ example: 4 }),
		webhook_access_count: z.number().openapi({ example: 3 }),
		view_access_count: z.number().openapi({ example: 10 }),
		edit_access_count: z.number().openapi({ example: 5 }),
		total_roles: z.number().openapi({ example: 10 }),
	})
	.openapi({ ref: "RoleStatsResponse" });

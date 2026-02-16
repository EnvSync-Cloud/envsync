import z from "zod";
import "zod-openapi/extend";

export const grantAccessRequestBodySchema = z
	.object({
		subject_id: z.string().openapi({ example: "user_123" }),
		subject_type: z.enum(["user", "team"]).openapi({ example: "user" }),
		relation: z.enum(["admin", "editor", "viewer"]).openapi({ example: "editor" }),
	})
	.openapi({ ref: "GrantAccessRequest" });

export const revokeAccessRequestBodySchema = z
	.object({
		subject_id: z.string().openapi({ example: "user_123" }),
		subject_type: z.enum(["user", "team"]).openapi({ example: "user" }),
		relation: z.enum(["admin", "editor", "viewer"]).openapi({ example: "editor" }),
	})
	.openapi({ ref: "RevokeAccessRequest" });

export const permissionMessageResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Access granted successfully" }),
	})
	.openapi({ ref: "PermissionMessageResponse" });

export const effectivePermissionsResponseSchema = z
	.object({
		can_view: z.boolean(),
		can_edit: z.boolean(),
		have_api_access: z.boolean(),
		have_billing_options: z.boolean(),
		have_webhook_access: z.boolean(),
		is_admin: z.boolean(),
		is_master: z.boolean(),
		can_manage_roles: z.boolean(),
		can_manage_users: z.boolean(),
		can_manage_apps: z.boolean(),
		can_manage_api_keys: z.boolean(),
		can_manage_webhooks: z.boolean(),
		can_view_audit_logs: z.boolean(),
		can_manage_org_settings: z.boolean(),
		can_manage_invites: z.boolean(),
	})
	.openapi({ ref: "EffectivePermissionsResponse" });

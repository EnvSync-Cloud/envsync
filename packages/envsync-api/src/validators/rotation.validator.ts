import z from "zod";
import "zod-openapi/extend";

const engineTypeEnum = z.enum(["postgres", "mysql", "aws-iam", "azure-sp", "gcp-service-account", "cloudflare-pages", "sendgrid", "twilio"]);

export const createRotationPolicySchema = z
	.object({
		app_id: z.string().uuid(),
		env_type_id: z.string().uuid(),
		variable_key: z.string().min(1).max(255),
		engine_type: engineTypeEnum,
		schedule_cron: z.string().min(1),
		dual_window_minutes: z.number().int().min(1).max(10080).default(60),
		enabled: z.boolean().default(true),
		connection_config: z.record(z.unknown()),
	})
	.openapi({ ref: "CreateRotationPolicyRequest" });

export const updateRotationPolicySchema = z
	.object({
		schedule_cron: z.string().min(1).optional(),
		dual_window_minutes: z.number().int().min(1).max(10080).optional(),
		enabled: z.boolean().optional(),
		connection_config: z.record(z.unknown()).optional(),
	})
	.openapi({ ref: "UpdateRotationPolicyRequest" });

export const rotationPolicyResponseSchema = z
	.object({
		id: z.string().uuid(),
		org_id: z.string().uuid(),
		app_id: z.string().uuid(),
		env_type_id: z.string().uuid(),
		variable_key: z.string(),
		engine_type: engineTypeEnum,
		schedule_cron: z.string(),
		dual_window_minutes: z.number(),
		enabled: z.boolean(),
		last_rotated_at: z.string().nullable(),
		next_rotation_at: z.string().nullable(),
		created_at: z.string(),
		updated_at: z.string(),
	})
	.openapi({ ref: "RotationPolicyResponse" });

export const rotationPoliciesResponseSchema = z
	.array(rotationPolicyResponseSchema)
	.openapi({ ref: "RotationPoliciesResponse" });

export const rotationStateResponseSchema = z
	.object({
		id: z.string().uuid(),
		rotation_policy_id: z.string().uuid(),
		rotated_at: z.string(),
		old_credential_expires_at: z.string(),
		old_credential_revoked: z.boolean(),
		revoked_at: z.string().nullable(),
		created_at: z.string(),
	})
	.openapi({ ref: "RotationStateResponse" });

export const rotationStatesResponseSchema = z
	.array(rotationStateResponseSchema)
	.openapi({ ref: "RotationStatesResponse" });

export const triggerRotationResponseSchema = z
	.object({
		message: z.string(),
		rotation_state_id: z.string().uuid(),
		new_credential_stored: z.boolean(),
		old_credential_expires_at: z.string(),
	})
	.openapi({ ref: "TriggerRotationResponse" });

export const revokeOldCredentialResponseSchema = z
	.object({
		message: z.string(),
		revoked_at: z.string(),
	})
	.openapi({ ref: "RevokeOldCredentialResponse" });

export const rotationIdParamSchema = z.object({
	id: z.string().uuid(),
});

export const getRotationPoliciesQuerySchema = z.object({
	app_id: z.string().uuid().optional(),
	env_type_id: z.string().uuid().optional(),
	enabled: z
		.enum(["true", "false"])
		.transform(v => v === "true")
		.optional(),
});

export type CreateRotationPolicyInput = z.infer<typeof createRotationPolicySchema>;
export type UpdateRotationPolicyInput = z.infer<typeof updateRotationPolicySchema>;

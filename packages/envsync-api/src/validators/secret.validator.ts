import z from "zod";
import "zod-openapi/extend";

const secretBaseSchema = z.object({
	key: z.string().openapi({ example: "API_SECRET_KEY" }),
	value: z.string().openapi({ example: "sk_live_abc123xyz789" }),
	app_id: z.string().openapi({ example: "app_123" }),
	env_type_id: z.string().openapi({ example: "env_type_123" }),
});

export const createSecretRequestSchema = secretBaseSchema.openapi({ ref: "CreateSecretRequest" });

export const updateSecretRequestSchema = secretBaseSchema
	.omit({ key: true })
	.openapi({ ref: "UpdateSecretRequest" });

export const deleteSecretRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		key: z.string().openapi({ example: "API_SECRET_KEY" }),
	})
	.openapi({ ref: "DeleteSecretRequest" });

export const getSecretRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
	})
	.openapi({ ref: "GetSecretRequest" });

export const batchSecretsRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		envs: z.array(
			z.object({
				key: z.string().openapi({ example: "JWT_SECRET" }),
				value: z.string().openapi({ example: "super_secret_jwt_key_123" }),
			}),
		).max(100),
	})
	.openapi({ ref: "BatchCreateSecretsRequest" });

export const batchSecretsDeleteRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		keys: z.array(z.string().openapi({ example: "API_SECRET_KEY" })).max(100),
	})
	.openapi({ ref: "BatchDeleteSecretsRequest" });

export const revealSecretsRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		keys: z.array(z.string().openapi({ example: "API_SECRET_KEY" })).max(100),
	})
	.openapi({ ref: "RevealSecretsRequest" });

export const batchSecretsResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Secrets updated successfully" }),
	})
	.openapi({ ref: "BatchSecretsResponse" });

export const secretResponseSchema = z
	.object({
		id: z.string().openapi({ example: "secret_123" }),
		key: z.string().openapi({ example: "API_SECRET_KEY" }),
		value: z.string().openapi({ example: "***ENCRYPTED***" }),
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		org_id: z.string().openapi({ example: "org_123" }),
		created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "SecretResponse" });

export const secretsResponseSchema = z
	.array(secretResponseSchema)
	.openapi({ ref: "SecretsResponse" });

// Point-in-Time related schemas
export const secretHistoryRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		page: z.coerce.number().int().min(1).default(1).openapi({ example: 1 }),
		per_page: z.coerce.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
	})
	.openapi({ ref: "SecretHistoryRequest" });

export const secretPitRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		pit_id: z.string().openapi({ example: "pit_123" }),
	})
	.openapi({ ref: "SecretPitRequest" });

export const secretTimestampRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		timestamp: z.string().datetime().openapi({ example: "2024-01-01T10:00:00Z" }),
	})
	.openapi({ ref: "SecretTimestampRequest" });

export const secretDiffRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		from_pit_id: z.string().openapi({ example: "pit_123" }),
		to_pit_id: z.string().openapi({ example: "pit_456" }),
	})
	.openapi({ ref: "SecretDiffRequest" });

export const secretVariableTimelineRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		key: z.string().openapi({ example: "API_SECRET_KEY" }),
		limit: z.number().int().min(1).max(100).default(50).openapi({ example: 50 }),
	})
	.openapi({ ref: "SecretVariableTimelineRequest" });

// Rollback schemas
export const rollbackSecretsToPitRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		pit_id: z.string().openapi({ example: "pit_123" }),
		rollback_message: z
			.string()
			.optional()
			.openapi({ example: "Rollback secrets due to security breach" }),
	})
	.openapi({ ref: "RollbackSecretsToPitRequest" });

export const rollbackSecretsToTimestampRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		timestamp: z.string().datetime().openapi({ example: "2024-01-01T10:00:00Z" }),
		rollback_message: z
			.string()
			.optional()
			.openapi({ example: "Rollback secrets to before incident" }),
	})
	.openapi({ ref: "RollbackSecretsToTimestampRequest" });

export const secretVariableRollbackToPitRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		pit_id: z.string().openapi({ example: "pit_123" }),
		rollback_message: z
			.string()
			.optional()
			.openapi({ example: "Rollback API_SECRET_KEY due to compromise" }),
	})
	.openapi({ ref: "SecretVariableRollbackToPitRequest" });

export const secretVariableRollbackToTimestampRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		timestamp: z.string().datetime().openapi({ example: "2024-01-01T10:00:00Z" }),
		rollback_message: z
			.string()
			.optional()
			.openapi({ example: "Restore JWT_SECRET to working version" }),
	})
	.openapi({ ref: "SecretVariableRollbackToTimestampRequest" });

// Enhanced CRUD with PiT tracking schemas
export const createSecretWithPitRequestSchema = secretBaseSchema
	.extend({
		change_message: z
			.string()
			.optional()
			.openapi({ example: "Added new API secret for payment gateway" }),
	})
	.openapi({ ref: "CreateSecretWithPitRequest" });

export const updateSecretWithPitRequestSchema = secretBaseSchema
	.omit({ key: true })
	.extend({
		change_message: z
			.string()
			.optional()
			.openapi({ example: "Updated API secret for security rotation" }),
	})
	.openapi({ ref: "UpdateSecretWithPitRequest" });

export const deleteSecretWithPitRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		key: z.string().openapi({ example: "API_SECRET_KEY" }),
		change_message: z.string().optional().openapi({ example: "Removed deprecated API secret" }),
	})
	.openapi({ ref: "DeleteSecretWithPitRequest" });

export const batchSecretsWithPitRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		envs: z.array(
			z.object({
				key: z.string().openapi({ example: "JWT_SECRET" }),
				value: z.string().openapi({ example: "super_secret_jwt_key_123" }),
			}),
		),
		change_message: z
			.string()
			.optional()
			.openapi({ example: "Batch update of authentication secrets" }),
	})
	.openapi({ ref: "BatchSecretsWithPitRequest" });

export const batchSecretsDeleteWithPitRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		keys: z.array(z.string().openapi({ example: "API_SECRET_KEY" })),
		change_message: z.string().optional().openapi({ example: "Cleanup of unused secrets" }),
	})
	.openapi({ ref: "BatchSecretsDeleteWithPitRequest" });

// Response schemas
export const secretHistoryResponseSchema = z
	.object({
		pits: z.array(
			z.object({
				id: z.string().openapi({ example: "pit_123" }),
				org_id: z.string().openapi({ example: "org_123" }),
				app_id: z.string().openapi({ example: "app_123" }),
				env_type_id: z.string().openapi({ example: "env_type_123" }),
				change_request_message: z.string().openapi({ example: "Updated API_SECRET_KEY" }),
				user_id: z.string().openapi({ example: "user_123" }),
				created_at: z.string().openapi({ example: "2024-01-01T10:00:00Z" }),
				updated_at: z.string().openapi({ example: "2024-01-01T10:00:00Z" }),
			}),
		),
		totalPages: z.number().int().openapi({ example: 5 }),
	})
	.openapi({ ref: "SecretHistoryResponse" });

export const secretPitStateResponseSchema = z
	.array(
		z.object({
			key: z.string().openapi({ example: "API_SECRET_KEY" }),
			value: z.string().openapi({ example: "***ENCRYPTED***" }),
			last_updated: z.string().openapi({ example: "2024-01-01T10:00:00Z" }),
		}),
	)
	.openapi({ ref: "SecretPitStateResponse" });

export const secretDiffResponseSchema = z
	.object({
		added: z.array(
			z.object({
				key: z.string().openapi({ example: "NEW_SECRET" }),
				value: z.string().openapi({ example: "***ENCRYPTED***" }),
			}),
		),
		modified: z.array(
			z.object({
				key: z.string().openapi({ example: "API_SECRET_KEY" }),
				old_value: z.string().openapi({ example: "***ENCRYPTED***" }),
				new_value: z.string().openapi({ example: "***ENCRYPTED***" }),
			}),
		),
		deleted: z.array(
			z.object({
				key: z.string().openapi({ example: "REMOVED_SECRET" }),
				value: z.string().openapi({ example: "***ENCRYPTED***" }),
			}),
		),
	})
	.openapi({ ref: "SecretDiffResponse" });

export const secretVariableTimelineResponseSchema = z
	.array(
		z.object({
			pit_id: z.string().openapi({ example: "pit_123" }),
			change_request_message: z.string().openapi({ example: "Updated API_SECRET_KEY" }),
			user_id: z.string().openapi({ example: "user_123" }),
			created_at: z.string().openapi({ example: "2024-01-01T10:00:00Z" }),
			value: z.string().openapi({ example: "***ENCRYPTED***" }),
			operation: z.enum(["CREATE", "UPDATE", "DELETE"]).openapi({ example: "UPDATE" }),
		}),
	)
	.openapi({ ref: "SecretVariableTimelineResponse" });

export const rollbackSecretsResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Secrets rollback completed successfully" }),
		operations_performed: z.number().int().openapi({ example: 3 }),
		operations: z.array(
			z.object({
				key: z.string().openapi({ example: "API_SECRET_KEY" }),
				value: z.string().openapi({ example: "***ENCRYPTED***" }),
				operation: z.enum(["CREATE", "UPDATE", "DELETE"]).openapi({ example: "UPDATE" }),
			}),
		),
	})
	.openapi({ ref: "RollbackSecretsResponse" });

export const secretVariableRollbackResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Secret variable rollback completed successfully" }),
		key: z.string().openapi({ example: "API_SECRET_KEY" }),
		operation: z.enum(["CREATE", "UPDATE", "DELETE"]).openapi({ example: "UPDATE" }),
		previous_value: z.string().nullable().openapi({ example: "***ENCRYPTED***" }),
		target_value: z.string().nullable().openapi({ example: "***ENCRYPTED***" }),
		pit_id: z.string().optional().openapi({ example: "pit_123" }),
		target_timestamp: z.string().optional().openapi({ example: "2024-01-01T10:00:00Z" }),
	})
	.openapi({ ref: "SecretVariableRollbackResponse" });

export const revealSecretsResponseSchema = z
	.array(
		z.object({
			id: z.string().openapi({ example: "secret_123" }),
			key: z.string().openapi({ example: "API_SECRET_KEY" }),
			value: z.string().openapi({ example: "sk_live_abc123xyz789" }),
			app_id: z.string().openapi({ example: "app_123" }),
			env_type_id: z.string().openapi({ example: "env_type_123" }),
			org_id: z.string().openapi({ example: "org_123" }),
			created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
			updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		}),
	)
	.openapi({ ref: "RevealSecretsResponse" });

import z from "zod";
import "zod-openapi/extend";

const envBaseSchema = z.object({
	key: z.string().openapi({ example: "DATABASE_URL" }),
	value: z.string().openapi({ example: "postgresql://localhost:5432/db" }),
	app_id: z.string().openapi({ example: "app_123" }),
	env_type_id: z.string().openapi({ example: "env_type_123" }),
});

export const createEnvRequestSchema = envBaseSchema.openapi({ ref: "CreateEnvRequest" });

export const updateEnvRequestSchema = envBaseSchema
	.omit({ key: true })
	.openapi({ ref: "UpdateEnvRequest" });

export const deleteEnvRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		key: z.string().openapi({ example: "DATABASE_URL" }),
	})
	.openapi({ ref: "DeleteEnvRequest" });

export const getEnvRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
	})
	.openapi({ ref: "GetEnvRequest" });

export const batchEnvsRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		envs: z.array(
			z.object({
				key: z.string().openapi({ example: "API_KEY" }),
				value: z.string().openapi({ example: "secret_key_123" }),
			}),
		).max(100),
	})
	.openapi({ ref: "BatchCreateEnvsRequest" });

export const batchEnvsDeleteRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		keys: z.array(z.string().openapi({ example: "API_KEY" })).max(100),
	})
	.openapi({ ref: "BatchDeleteEnvsRequest" });

export const batchEnvsResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Environment variables updated successfully" }),
	})
	.openapi({ ref: "BatchEnvsResponse" });

export const envResponseSchema = z
	.object({
		id: z.string().openapi({ example: "env_123" }),
		key: z.string().openapi({ example: "DATABASE_URL" }),
		value: z.string().openapi({ example: "postgresql://localhost:5432/db" }),
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		org_id: z.string().openapi({ example: "org_123" }),
		created_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2023-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "EnvResponse" });

export const envsResponseSchema = z.array(envResponseSchema).openapi({ ref: "EnvsResponse" });

// New Point-in-Time related schemas
export const envHistoryRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		page: z.number().int().min(1).default(1).openapi({ example: 1 }),
		per_page: z.number().int().min(1).max(100).default(20).openapi({ example: 20 }),
	})
	.openapi({ ref: "EnvHistoryRequest" });

export const envPitRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		pit_id: z.string().openapi({ example: "pit_123" }),
	})
	.openapi({ ref: "EnvPitRequest" });

export const envTimestampRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		timestamp: z.string().datetime().openapi({ example: "2024-01-01T10:00:00Z" }),
	})
	.openapi({ ref: "EnvTimestampRequest" });

export const envDiffRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		from_pit_id: z.string().openapi({ example: "pit_123" }),
		to_pit_id: z.string().openapi({ example: "pit_456" }),
	})
	.openapi({ ref: "EnvDiffRequest" });

export const variableTimelineRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		key: z.string().openapi({ example: "DATABASE_URL" }),
		limit: z.number().int().min(1).max(100).default(50).openapi({ example: 50 }),
	})
	.openapi({ ref: "VariableTimelineRequest" });

// Rollback schemas
export const rollbackToPitRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		pit_id: z.string().openapi({ example: "pit_123" }),
		rollback_message: z
			.string()
			.optional()
			.openapi({ example: "Rollback due to configuration error" }),
	})
	.openapi({ ref: "RollbackToPitRequest" });

export const rollbackToTimestampRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		timestamp: z.string().datetime().openapi({ example: "2024-01-01T10:00:00Z" }),
		rollback_message: z.string().optional().openapi({ example: "Rollback to before deployment" }),
	})
	.openapi({ ref: "RollbackToTimestampRequest" });

export const variableRollbackToPitRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		pit_id: z.string().openapi({ example: "pit_123" }),
		rollback_message: z
			.string()
			.optional()
			.openapi({ example: "Rollback DATABASE_URL due to connection issues" }),
	})
	.openapi({ ref: "VariableRollbackToPitRequest" });

export const variableRollbackToTimestampRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		timestamp: z.string().datetime().openapi({ example: "2024-01-01T10:00:00Z" }),
		rollback_message: z
			.string()
			.optional()
			.openapi({ example: "Restore API_KEY to working version" }),
	})
	.openapi({ ref: "VariableRollbackToTimestampRequest" });

// Response schemas
export const envHistoryResponseSchema = z
	.object({
		pits: z.array(
			z.object({
				id: z.string().openapi({ example: "pit_123" }),
				org_id: z.string().openapi({ example: "org_123" }),
				app_id: z.string().openapi({ example: "app_123" }),
				env_type_id: z.string().openapi({ example: "env_type_123" }),
				change_request_message: z.string().openapi({ example: "Updated DATABASE_URL" }),
				user_id: z.string().openapi({ example: "user_123" }),
				created_at: z.string().openapi({ example: "2024-01-01T10:00:00Z" }),
				updated_at: z.string().openapi({ example: "2024-01-01T10:00:00Z" }),
			}),
		),
		totalPages: z.number().int().openapi({ example: 5 }),
	})
	.openapi({ ref: "EnvHistoryResponse" });

export const envPitStateResponseSchema = z
	.array(
		z.object({
			key: z.string().openapi({ example: "DATABASE_URL" }),
			value: z.string().openapi({ example: "postgresql://localhost:5432/db" }),
			last_updated: z.string().openapi({ example: "2024-01-01T10:00:00Z" }),
			operation: z.enum(["CREATE", "UPDATE", "DELETE"]).openapi({ example: "UPDATE" }),
		}),
	)
	.openapi({ ref: "EnvPitStateResponse" });

export const envDiffResponseSchema = z
	.object({
		added: z.array(
			z.object({
				key: z.string().openapi({ example: "NEW_VAR" }),
				value: z.string().openapi({ example: "new_value" }),
			}),
		),
		modified: z.array(
			z.object({
				key: z.string().openapi({ example: "DATABASE_URL" }),
				old_value: z.string().openapi({ example: "old_connection" }),
				new_value: z.string().openapi({ example: "new_connection" }),
			}),
		),
		deleted: z.array(
			z.object({
				key: z.string().openapi({ example: "REMOVED_VAR" }),
				value: z.string().openapi({ example: "removed_value" }),
			}),
		),
	})
	.openapi({ ref: "EnvDiffResponse" });

export const variableTimelineResponseSchema = z
	.array(
		z.object({
			pit_id: z.string().openapi({ example: "pit_123" }),
			change_request_message: z.string().openapi({ example: "Updated DATABASE_URL" }),
			user_id: z.string().openapi({ example: "user_123" }),
			created_at: z.string().openapi({ example: "2024-01-01T10:00:00Z" }),
			value: z.string().openapi({ example: "postgresql://localhost:5432/db" }),
			operation: z.enum(["CREATE", "UPDATE", "DELETE"]).openapi({ example: "UPDATE" }),
		}),
	)
	.openapi({ ref: "VariableTimelineResponse" });

export const rollbackResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Rollback completed successfully" }),
		operations_performed: z.number().int().openapi({ example: 3 }),
		operations: z.array(
			z.object({
				key: z.string().openapi({ example: "DATABASE_URL" }),
				value: z.string().openapi({ example: "postgresql://localhost:5432/db" }),
				operation: z.enum(["CREATE", "UPDATE", "DELETE"]).openapi({ example: "UPDATE" }),
			}),
		),
	})
	.openapi({ ref: "RollbackResponse" });

export const variableRollbackResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Variable rollback completed successfully" }),
		key: z.string().openapi({ example: "DATABASE_URL" }),
		operation: z.enum(["CREATE", "UPDATE", "DELETE"]).openapi({ example: "UPDATE" }),
		previous_value: z.string().nullable().openapi({ example: "old_value" }),
		target_value: z.string().nullable().openapi({ example: "new_value" }),
		pit_id: z.string().optional().openapi({ example: "pit_123" }),
		target_timestamp: z.string().optional().openapi({ example: "2024-01-01T10:00:00Z" }),
	})
	.openapi({ ref: "VariableRollbackResponse" });

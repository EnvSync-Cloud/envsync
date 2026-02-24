import { type Context } from "hono";

import { EnvService } from "@/services/env.service";
import { AuditLogService } from "@/services/audit_log.service";
import { AuthorizationService } from "@/services/authorization.service";
import { EnvTypeService } from "@/services/env_type.service";
import { EnvStorePiTService } from "@/services/env_store_pit.service";

export class EnvController {
	public static readonly createEnv = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");

		const { key, value, app_id, env_type_id } = await c.req.json();

		if (!key || !org_id || !app_id || !env_type_id) {
			return c.json({ error: "key, org_id, app_id, and env_type_id are required." }, 400);
		}

		// env_type_id
		const env_type = await EnvTypeService.getEnvType(env_type_id);

		const canEdit = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to perform this action." }, 403);
		}

		// Check if the environment variable already exists
		const existingEnv = await EnvService.getEnv({
			app_id,
			env_type_id,
			key,
			org_id,
		});

		if (existingEnv) {
			return c.json({ error: "Environment variable already exists." }, 400);
		}

		const env = await EnvService.createEnv({
			key,
			org_id,
			value: value || "",
			app_id,
			env_type_id,
		});

		// Create Point-in-Time record for tracking
		await EnvStorePiTService.createEnvStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message: `Created environment variable: ${key}`,
			user_id,
			envs: [
				{
					key,
					value: value || "",
					operation: "CREATE",
				},
			],
		});

		// Log the creation of the environment variable
		await AuditLogService.notifyAuditSystem({
			action: "env_created",
			org_id,
			user_id,
			message: `Environment variable ${key} created in app ${app_id} for environment type ${env_type_id}.`,
			details: {
				env_id: env.id,
				key,
				app_id,
				env_type_id,
			},
		});

		return c.json(env, 201);
	};

	public static readonly updateEnv = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { key } = c.req.param();
		const { value, app_id, env_type_id } = await c.req.json();

		if (!key || !org_id || !app_id || !env_type_id) {
			return c.json({ error: "key, org_id, app_id, and env_type_id are required." }, 400);
		}

		// env_type_id
		const env_type = await EnvTypeService.getEnvType(env_type_id);

		const canEdit = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to perform this action." }, 403);
		}

		// Get current value for tracking
		const currentEnv = await EnvService.getEnv({
			key,
			org_id,
			app_id,
			env_type_id,
		});

		if (!currentEnv) {
			return c.json({ error: "Environment variable not found." }, 404);
		}

		await EnvService.updateEnv({
			key,
			org_id,
			value: value || "",
			app_id,
			env_type_id,
		});

		// Create Point-in-Time record for tracking
		await EnvStorePiTService.createEnvStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message: `Updated environment variable: ${key} (${currentEnv.value} → ${value || ""})`,
			user_id,
			envs: [
				{
					key,
					value: value || "",
					operation: "UPDATE",
				},
			],
		});

		// Log the update of the environment variable
		await AuditLogService.notifyAuditSystem({
			action: "env_updated",
			org_id,
			user_id,
			message: `Environment variable ${key} updated in app ${app_id} for environment type ${env_type_id}.`,
			details: {
				key,
				app_id,
				env_type_id,
				old_value: currentEnv.value,
				new_value: value || "",
			},
		});

		return c.json({ message: "Env updated successfully" });
	};

	public static readonly deleteEnv = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { app_id, env_type_id, key } = await c.req.json();

		if (!org_id || !app_id || !env_type_id || !key) {
			return c.json({ error: "org_id, app_id, env_type_id, and key are required." }, 400);
		}

		// env_type_id
		const env_type = await EnvTypeService.getEnvType(env_type_id);

		const canEdit = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to perform this action." }, 403);
		}

		// Get current value for tracking
		const currentEnv = await EnvService.getEnv({
			key,
			org_id,
			app_id,
			env_type_id,
		});

		if (!currentEnv) {
			return c.json({ error: "Environment variable not found." }, 404);
		}

		await EnvService.deleteEnv({
			app_id,
			env_type_id,
			key,
			org_id,
		});

		// Create Point-in-Time record for tracking
		await EnvStorePiTService.createEnvStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message: `Deleted environment variable: ${key} (value: ${currentEnv.value})`,
			user_id,
			envs: [
				{
					key,
					value: currentEnv.value,
					operation: "DELETE",
				},
			],
		});

		// Log the deletion of the environment variable
		await AuditLogService.notifyAuditSystem({
			action: "env_deleted",
			org_id,
			user_id,
			message: `Environment variable ${key} deleted from app ${app_id} for environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				key,
				deleted_value: currentEnv.value,
			},
		});

		return c.json({ message: "Env deleted successfully" });
	};

	public static readonly getEnv = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { key } = c.req.param();
		const { app_id, env_type_id } = await c.req.json();

		if (!org_id || !app_id || !env_type_id || !key) {
			return c.json({ error: "org_id, app_id, env_type_id, and key are required." }, 400);
		}

		const canView = await AuthorizationService.check(c.get("user_id"), "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		const env = await EnvService.getEnv({
			app_id,
			env_type_id,
			key,
			org_id,
		});

		// Log the retrieval of the environment variable
		await AuditLogService.notifyAuditSystem({
			action: "env_viewed",
			org_id,
			user_id,
			message: `Environment variable ${key} viewed in app ${app_id} for environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				key,
			},
		});

		return c.json(env);
	};

	public static readonly getEnvs = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { app_id, env_type_id } = await c.req.json();

		if (!org_id || !app_id || !env_type_id) {
			return c.json({ error: "org_id, app_id, and env_type_id are required." }, 400);
		}

		const canView = await AuthorizationService.check(c.get("user_id"), "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		const envs = await EnvService.getAllEnv({
			app_id,
			env_type_id,
			org_id,
		});

		// Log the retrieval of the environment variables
		await AuditLogService.notifyAuditSystem({
			action: "envs_viewed",
			org_id,
			user_id,
			message: `Environment variables viewed in app ${app_id} for environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
			},
		});

		return c.json(envs);
	};

	public static readonly batchCreateEnvs = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { app_id, env_type_id, envs } = await c.req.json();

		if (!envs || !Array.isArray(envs)) {
			return c.json({ error: "envs must be an array." }, 400);
		}

		if (envs.length > 100) {
			return c.json({ error: "Batch size exceeds maximum of 100 items" }, 400);
		}

		// env_type_id
		const env_type = await EnvTypeService.getEnvType(env_type_id);

		const canEdit = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to perform this action." }, 403);
		}

		await EnvService.batchCreateEnvs(org_id, app_id, env_type_id, envs);

		// Create Point-in-Time record for batch creation
		await EnvStorePiTService.createEnvStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message: `Batch created ${envs.length} environment variables: ${envs.map(env => env.key).join(", ")}`,
			user_id,
			envs: envs.map(env => ({
				key: env.key,
				value: env.value,
				operation: "CREATE" as const,
			})),
		});

		// Log the batch creation of environment variables
		await AuditLogService.notifyAuditSystem({
			action: "envs_batch_created",
			org_id,
			user_id,
			message: `Batch creation of environment variables in app ${app_id} for environment type ${env_type_id} for keys: ${envs.map(env => env.key).join(", ")}.`,
			details: {
				app_id,
				env_type_id,
				env_count: envs.length,
				keys: envs.map(env => env.key),
			},
		});

		return c.json({ message: "Envs created successfully" }, 201);
	};

	public static readonly batchUpdateEnvs = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { app_id, env_type_id, envs } = await c.req.json();

		if (!envs || !Array.isArray(envs)) {
			return c.json({ error: "envs must be an array." }, 400);
		}

		if (envs.length > 100) {
			return c.json({ error: "Batch size exceeds maximum of 100 items" }, 400);
		}

		// env_type_id
		const env_type = await EnvTypeService.getEnvType(env_type_id);

		const canEdit = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to perform this action." }, 403);
		}

		// Get current values for tracking changes
		const currentEnvs = await Promise.all(
			envs.map(env =>
				EnvService.getEnv({
					key: env.key,
					org_id,
					app_id,
					env_type_id,
				}),
			),
		);

		await EnvService.batchUpdateEnvs(org_id, app_id, env_type_id, envs);

		// Create detailed change message
		const changes = envs.map((env, index) => {
			const currentEnv = currentEnvs[index];
			return `${env.key}: ${currentEnv?.value || "undefined"} → ${env.value}`;
		});

		// Create Point-in-Time record for batch update
		await EnvStorePiTService.createEnvStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message: `Batch updated ${envs.length} environment variables: ${changes.join(", ")}`,
			user_id,
			envs: envs.map(env => ({
				key: env.key,
				value: env.value,
				operation: "UPDATE" as const,
			})),
		});

		// Log the batch update of environment variables
		await AuditLogService.notifyAuditSystem({
			action: "envs_batch_updated",
			org_id,
			user_id,
			message: `Batch update of environment variables in app ${app_id} for environment type ${env_type_id} for keys: ${envs.map(env => env.key).join(", ")}.`,
			details: {
				app_id,
				env_type_id,
				env_count: envs.length,
				keys: envs.map(env => env.key),
				changes: changes,
			},
		});

		return c.json({ message: "Envs updated successfully" }, 200);
	};

	public static readonly batchDeleteEnvs = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { app_id, env_type_id, keys } = await c.req.json();

		if (!keys || !Array.isArray(keys)) {
			return c.json({ error: "keys must be an array." }, 400);
		}

		if (keys.length > 100) {
			return c.json({ error: "Batch size exceeds maximum of 100 items" }, 400);
		}

		// env_type_id
		const env_type = await EnvTypeService.getEnvType(env_type_id);

		const canEdit = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to perform this action." }, 403);
		}

		// Get current values for tracking deletions
		const currentEnvs = await Promise.all(
			keys.map(key =>
				EnvService.getEnv({
					key,
					org_id,
					app_id,
					env_type_id,
				}),
			),
		);

		await EnvService.batchDeleteEnvs(org_id, app_id, env_type_id, keys);

		// Create Point-in-Time record for batch deletion
		const deletedEnvs = currentEnvs
			.filter(env => env !== null)
			.map(env => ({
				key: env!.key,
				value: env!.value,
				operation: "DELETE" as const,
			}));

		if (deletedEnvs.length > 0) {
			await EnvStorePiTService.createEnvStorePiT({
				org_id,
				app_id,
				env_type_id,
				change_request_message: `Batch deleted ${deletedEnvs.length} environment variables: ${deletedEnvs.map(env => `${env.key} (${env.value})`).join(", ")}`,
				user_id,
				envs: deletedEnvs,
			});
		}

		// Log the batch deletion of environment variables
		await AuditLogService.notifyAuditSystem({
			action: "envs_batch_deleted",
			org_id,
			user_id,
			message: `Batch deletion of environment variables in app ${app_id} for environment type ${env_type_id} for keys: ${keys.join(", ")}.`,
			details: {
				app_id,
				env_type_id,
				keys,
				deleted_values: currentEnvs
					.filter(env => env)
					.map(env => ({ key: env!.key, value: env!.value })),
			},
		});

		return c.json({ message: "Envs deleted successfully" }, 200);
	};

	// New Point-in-Time related endpoints
	public static readonly getEnvHistory = async (c: Context) => {
		const org_id = c.get("org_id");
		const { app_id, env_type_id, page, per_page } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id) {
			return c.json({ error: "org_id, app_id, and env_type_id are required." }, 400);
		}

		const canView = await AuthorizationService.check(c.get("user_id"), "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		const history = await EnvStorePiTService.getEnvStorePiTs({
			org_id,
			app_id,
			env_type_id,
			page,
			per_page,
		});

		return c.json(history);
	};

	public static readonly getEnvsAtPointInTime = async (c: Context) => {
		const org_id = c.get("org_id");
		const { app_id, env_type_id, pit_id } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id || !pit_id) {
			return c.json({ error: "org_id, app_id, env_type_id, and pit_id are required." }, 400);
		}

		const canView = await AuthorizationService.check(c.get("user_id"), "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		const envs = await EnvStorePiTService.getEnvsTillPiTId({
			org_id,
			app_id,
			env_type_id,
			env_store_pit_id: pit_id,
		});

		return c.json(envs);
	};

	public static readonly getEnvsAtTimestamp = async (c: Context) => {
		const org_id = c.get("org_id");
		const { app_id, env_type_id, timestamp } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id || !timestamp) {
			return c.json({ error: "org_id, app_id, env_type_id, and timestamp are required." }, 400);
		}

		const canView = await AuthorizationService.check(c.get("user_id"), "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		const envs = await EnvStorePiTService.getEnvsTillTimestamp({
			org_id,
			app_id,
			env_type_id,
			timestamp: new Date(timestamp),
		});

		return c.json(envs);
	};

	public static readonly getEnvDiff = async (c: Context) => {
		const org_id = c.get("org_id");
		const { app_id, env_type_id, from_pit_id, to_pit_id } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id || !from_pit_id || !to_pit_id) {
			return c.json(
				{ error: "org_id, app_id, env_type_id, from_pit_id, and to_pit_id are required." },
				400,
			);
		}

		const canView = await AuthorizationService.check(c.get("user_id"), "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		const diff = await EnvStorePiTService.getEnvDiff({
			org_id,
			app_id,
			env_type_id,
			from_pit_id,
			to_pit_id,
		});

		// Log the retrieval of the environment diff
		await AuditLogService.notifyAuditSystem({
			action: "env_variable_diff_viewed",
			org_id,
			user_id: c.get("user_id"),
			message: `Environment diff viewed from PiT ${from_pit_id} to ${to_pit_id} in app ${app_id} for environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				from_pit_id,
				to_pit_id,
			},
		});

		return c.json(diff);
	};

	public static readonly getVariableTimeline = async (c: Context) => {
		const org_id = c.get("org_id");
		const { key } = c.req.param();
		const { app_id, env_type_id, limit } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id || !key) {
			return c.json({ error: "org_id, app_id, env_type_id, and key are required." }, 400);
		}

		const canView = await AuthorizationService.check(c.get("user_id"), "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		const timeline = await EnvStorePiTService.getVariableTimeline({
			org_id,
			app_id,
			env_type_id,
			key,
			limit,
		});

		// Log the retrieval of the variable timeline
		await AuditLogService.notifyAuditSystem({
			action: "env_variable_timeline_viewed",
			org_id,
			user_id: c.get("user_id"),
			message: `Variable timeline viewed for key ${key} in app ${app_id} for environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				key,
				limit,
			},
		});

		return c.json(timeline);
	};

	public static readonly rollbackEnvsToPitId = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { app_id, env_type_id, pit_id, rollback_message } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id || !pit_id) {
			return c.json({ error: "org_id, app_id, env_type_id, and pit_id are required." }, 400);
		}

		// Check env type permissions
		const env_type = await EnvTypeService.getEnvType(env_type_id);

		const canEdit = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to perform this action." }, 403);
		}

		// Get current state for comparison
		const currentEnvs = await EnvService.getAllEnv({
			app_id,
			env_type_id,
			org_id,
		});

		// Get target state from PiT
		const targetEnvs = await EnvStorePiTService.getEnvsTillPiTId({
			org_id,
			app_id,
			env_type_id,
			env_store_pit_id: pit_id,
		});

		// Create maps for comparison
		const currentMap = new Map(currentEnvs.map(env => [env.key, env.value]));
		const targetMap = new Map(targetEnvs.map(env => [env.key, env.value]));

		const rollbackOperations = [];

		// Find variables to delete (exist in current but not in target)
		for (const [key, value] of currentMap) {
			if (!targetMap.has(key)) {
				await EnvService.deleteEnv({
					key,
					app_id,
					env_type_id,
					org_id,
				});
				rollbackOperations.push({
					key,
					value,
					operation: "DELETE" as const,
				});
			}
		}

		// Find variables to create or update
		for (const [key, value] of targetMap) {
			if (!currentMap.has(key)) {
				// Create new variable
				await EnvService.createEnv({
					key,
					value,
					app_id,
					env_type_id,
					org_id,
				});
				rollbackOperations.push({
					key,
					value,
					operation: "CREATE" as const,
				});
			} else if (currentMap.get(key) !== value) {
				// Update existing variable
				await EnvService.updateEnv({
					key,
					value,
					app_id,
					env_type_id,
					org_id,
				});
				rollbackOperations.push({
					key,
					value,
					operation: "UPDATE" as const,
				});
			}
		}

		// Create PiT record for rollback operation
		if (rollbackOperations.length > 0) {
			await EnvStorePiTService.createEnvStorePiT({
				org_id,
				app_id,
				env_type_id,
				change_request_message:
					rollback_message ||
					`Rollback to PiT ${pit_id}: ${rollbackOperations.length} variables affected`,
				user_id,
				envs: rollbackOperations,
			});

			// Log the rollback operation
			await AuditLogService.notifyAuditSystem({
				action: "envs_rollback_pit",
				org_id,
				user_id,
				message: `Environment variables rolled back to PiT ${pit_id} in app ${app_id} for environment type ${env_type_id}.`,
				details: {
					app_id,
					env_type_id,
					pit_id,
					operations_count: rollbackOperations.length,
					operations: rollbackOperations,
				},
			});
		}

		return c.json({
			message: "Rollback completed successfully",
			operations_performed: rollbackOperations.length,
			operations: rollbackOperations,
		});
	};

	public static readonly rollbackEnvsToTimestamp = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { app_id, env_type_id, timestamp, rollback_message } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id || !timestamp) {
			return c.json({ error: "org_id, app_id, env_type_id, and timestamp are required." }, 400);
		}

		// Check env type permissions
		const env_type = await EnvTypeService.getEnvType(env_type_id);

		const canEdit = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to perform this action." }, 403);
		}

		// Validate timestamp
		const targetTimestamp = new Date(timestamp);
		if (isNaN(targetTimestamp.getTime())) {
			return c.json({ error: "Invalid timestamp format." }, 400);
		}

		// Get current state for comparison
		const currentEnvs = await EnvService.getAllEnv({
			app_id,
			env_type_id,
			org_id,
		});

		// Get target state from timestamp
		const targetEnvs = await EnvStorePiTService.getEnvsTillTimestamp({
			org_id,
			app_id,
			env_type_id,
			timestamp: targetTimestamp,
		});

		// Create maps for comparison
		const currentMap = new Map(currentEnvs.map(env => [env.key, env.value]));
		const targetMap = new Map(targetEnvs.map(env => [env.key, env.value]));

		const rollbackOperations = [];

		// Find variables to delete (exist in current but not in target)
		for (const [key, value] of currentMap) {
			if (!targetMap.has(key)) {
				await EnvService.deleteEnv({
					key,
					app_id,
					env_type_id,
					org_id,
				});
				rollbackOperations.push({
					key,
					value,
					operation: "DELETE" as const,
				});
			}
		}

		// Find variables to create or update
		for (const [key, value] of targetMap) {
			if (!currentMap.has(key)) {
				// Create new variable
				await EnvService.createEnv({
					key,
					value,
					app_id,
					env_type_id,
					org_id,
				});
				rollbackOperations.push({
					key,
					value,
					operation: "CREATE" as const,
				});
			} else if (currentMap.get(key) !== value) {
				// Update existing variable
				await EnvService.updateEnv({
					key,
					value,
					app_id,
					env_type_id,
					org_id,
				});
				rollbackOperations.push({
					key,
					value,
					operation: "UPDATE" as const,
				});
			}
		}

		// Create PiT record for rollback operation
		if (rollbackOperations.length > 0) {
			await EnvStorePiTService.createEnvStorePiT({
				org_id,
				app_id,
				env_type_id,
				change_request_message:
					rollback_message ||
					`Rollback to timestamp ${targetTimestamp.toISOString()}: ${rollbackOperations.length} variables affected`,
				user_id,
				envs: rollbackOperations,
			});

			// Log the rollback operation
			await AuditLogService.notifyAuditSystem({
				action: "envs_rollback_timestamp",
				org_id,
				user_id,
				message: `Environment variables rolled back to timestamp ${targetTimestamp.toISOString()} in app ${app_id} for environment type ${env_type_id}.`,
				details: {
					app_id,
					env_type_id,
					timestamp: targetTimestamp.toISOString(),
					operations_count: rollbackOperations.length,
					operations: rollbackOperations,
				},
			});
		}

		return c.json({
			message: "Rollback completed successfully",
			target_timestamp: targetTimestamp.toISOString(),
			operations_performed: rollbackOperations.length,
			operations: rollbackOperations,
		});
	};

	public static readonly rollbackVariableToPitId = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { key } = c.req.param();
		const { app_id, env_type_id, pit_id, rollback_message } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id || !pit_id || !key) {
			return c.json({ error: "org_id, app_id, env_type_id, pit_id, and key are required." }, 400);
		}

		// Check env type permissions
		const env_type = await EnvTypeService.getEnvType(env_type_id);

		const canEdit = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to perform this action." }, 403);
		}

		// Get current variable state
		const currentEnv = await EnvService.getEnv({
			key,
			app_id,
			env_type_id,
			org_id,
		});

		// Get target state from PiT
		const targetEnvs = await EnvStorePiTService.getEnvsTillPiTId({
			org_id,
			app_id,
			env_type_id,
			env_store_pit_id: pit_id,
		});

		// Find the specific variable in target state
		const targetEnv = targetEnvs.find(env => env.key === key);
		let rollbackOperation = null;

		if (!targetEnv && currentEnv) {
			// Variable exists now but didn't exist at target PiT - DELETE it
			await EnvService.deleteEnv({
				key,
				app_id,
				env_type_id,
				org_id,
			});
			rollbackOperation = {
				key,
				value: currentEnv.value,
				operation: "DELETE" as const,
				previous_value: currentEnv.value,
				target_value: null,
			};
		} else if (targetEnv && !currentEnv) {
			// Variable didn't exist now but existed at target PiT - CREATE it
			await EnvService.createEnv({
				key,
				value: targetEnv.value,
				app_id,
				env_type_id,
				org_id,
			});
			rollbackOperation = {
				key,
				value: targetEnv.value,
				operation: "CREATE" as const,
				previous_value: null,
				target_value: targetEnv.value,
			};
		} else if (targetEnv && currentEnv && targetEnv.value !== currentEnv.value) {
			// Variable exists in both but values differ - UPDATE it
			await EnvService.updateEnv({
				key,
				value: targetEnv.value,
				app_id,
				env_type_id,
				org_id,
			});
			rollbackOperation = {
				key,
				value: targetEnv.value,
				operation: "UPDATE" as const,
				previous_value: currentEnv.value,
				target_value: targetEnv.value,
			};
		} else {
			// No changes needed
			return c.json({
				message: "No rollback needed - variable is already at target state",
				key,
				current_value: currentEnv?.value || null,
				target_value: targetEnv?.value || null,
			});
		}

		// Create PiT record for rollback operation
		await EnvStorePiTService.createEnvStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message:
				rollback_message ||
				`Rollback variable ${key} to PiT ${pit_id}: ${rollbackOperation.previous_value} → ${rollbackOperation.target_value}`,
			user_id,
			envs: [
				{
					key: rollbackOperation.key,
					value: rollbackOperation.value,
					operation: rollbackOperation.operation,
				},
			],
		});

		// Log the rollback operation
		await AuditLogService.notifyAuditSystem({
			action: "env_variable_rollback_pit",
			org_id,
			user_id,
			message: `Environment variable ${key} rolled back to PiT ${pit_id} in app ${app_id} for environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				key,
				pit_id,
				operation: rollbackOperation.operation,
				previous_value: rollbackOperation.previous_value,
				target_value: rollbackOperation.target_value,
			},
		});

		return c.json({
			message: "Variable rollback completed successfully",
			key,
			operation: rollbackOperation.operation,
			previous_value: rollbackOperation.previous_value,
			target_value: rollbackOperation.target_value,
			pit_id,
		});
	};

	public static readonly rollbackVariableToTimestamp = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { key } = c.req.param();
		const { app_id, env_type_id, timestamp, rollback_message } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id || !timestamp || !key) {
			return c.json(
				{ error: "org_id, app_id, env_type_id, timestamp, and key are required." },
				400,
			);
		}

		// Check env type permissions
		const env_type = await EnvTypeService.getEnvType(env_type_id);

		const canEdit = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to perform this action." }, 403);
		}

		// Validate timestamp
		const targetTimestamp = new Date(timestamp);
		if (isNaN(targetTimestamp.getTime())) {
			return c.json({ error: "Invalid timestamp format." }, 400);
		}

		// Get current variable state
		const currentEnv = await EnvService.getEnv({
			key,
			app_id,
			env_type_id,
			org_id,
		});

		// Get target state from timestamp
		const targetEnvs = await EnvStorePiTService.getEnvsTillTimestamp({
			org_id,
			app_id,
			env_type_id,
			timestamp: targetTimestamp,
		});

		// Find the specific variable in target state
		const targetEnv = targetEnvs.find(env => env.key === key);
		let rollbackOperation = null;

		if (!targetEnv && currentEnv) {
			// Variable exists now but didn't exist at target timestamp - DELETE it
			await EnvService.deleteEnv({
				key,
				app_id,
				env_type_id,
				org_id,
			});
			rollbackOperation = {
				key,
				value: currentEnv.value,
				operation: "DELETE" as const,
				previous_value: currentEnv.value,
				target_value: null,
			};
		} else if (targetEnv && !currentEnv) {
			// Variable didn't exist now but existed at target timestamp - CREATE it
			await EnvService.createEnv({
				key,
				value: targetEnv.value,
				app_id,
				env_type_id,
				org_id,
			});
			rollbackOperation = {
				key,
				value: targetEnv.value,
				operation: "CREATE" as const,
				previous_value: null,
				target_value: targetEnv.value,
			};
		} else if (targetEnv && currentEnv && targetEnv.value !== currentEnv.value) {
			// Variable exists in both but values differ - UPDATE it
			await EnvService.updateEnv({
				key,
				value: targetEnv.value,
				app_id,
				env_type_id,
				org_id,
			});
			rollbackOperation = {
				key,
				value: targetEnv.value,
				operation: "UPDATE" as const,
				previous_value: currentEnv.value,
				target_value: targetEnv.value,
			};
		} else {
			// No changes needed
			return c.json({
				message: "No rollback needed - variable is already at target state",
				key,
				current_value: currentEnv?.value || null,
				target_value: targetEnv?.value || null,
				target_timestamp: targetTimestamp.toISOString(),
			});
		}

		// Create PiT record for rollback operation
		await EnvStorePiTService.createEnvStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message:
				rollback_message ||
				`Rollback variable ${key} to ${targetTimestamp.toISOString()}: ${rollbackOperation.previous_value} → ${rollbackOperation.target_value}`,
			user_id,
			envs: [
				{
					key: rollbackOperation.key,
					value: rollbackOperation.value,
					operation: rollbackOperation.operation,
				},
			],
		});

		// Log the rollback operation
		await AuditLogService.notifyAuditSystem({
			action: "env_variable_rollback_timestamp",
			org_id,
			user_id,
			message: `Environment variable ${key} rolled back to timestamp ${targetTimestamp.toISOString()} in app ${app_id} for environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				key,
				timestamp: targetTimestamp.toISOString(),
				operation: rollbackOperation.operation,
				previous_value: rollbackOperation.previous_value,
				target_value: rollbackOperation.target_value,
			},
		});

		return c.json({
			message: "Variable rollback completed successfully",
			key,
			operation: rollbackOperation.operation,
			previous_value: rollbackOperation.previous_value,
			target_value: rollbackOperation.target_value,
			target_timestamp: targetTimestamp.toISOString(),
		});
	};
}

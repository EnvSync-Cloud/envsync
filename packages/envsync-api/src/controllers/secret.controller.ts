import { SecretStorePiTService } from "@/services/secret_store_pit.service";
import { type Context } from "hono";

import { SecretService } from "@/services/secret.service";
import { AuditLogService } from "@/services/audit_log.service";
import { EnvTypeService } from "@/services/env_type.service";
import { AppService } from "@/services/app.service";
import { AuthorizationService } from "@/services/authorization.service";
import { secretOperations } from "@/libs/telemetry/metrics";

export class SecretController {
	public static readonly createSecret = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");

		const { key, value, app_id, env_type_id, change_message } = await c.req.json();

		if (!key || !org_id || !app_id || !env_type_id) {
			return c.json({ error: "key, org_id, app_id, and env_type_id are required." }, 400);
		}

		// env_type_id
		const env_type = await EnvTypeService.getEnvType(env_type_id);

		const canEdit = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to perform this action." }, 403);
		}

		// Check if the secret already exists
		const existingSecret = await SecretService.getSecret({
			app_id,
			env_type_id,
			key,
			org_id,
		});

		if (existingSecret) {
			return c.json({ error: "Secret already exists." }, 400);
		}

		const app = await AppService.getApp({
			id: app_id,
		});
		if (!app) {
			return c.json({ error: "App not found." }, 404);
		}

		// Check if the app belongs to the organization
		if (app.org_id !== org_id) {
			return c.json({ error: "App does not belong to the organization." }, 403);
		}

		if (!app.enable_secrets) {
			return c.json({ error: "Secrets are not enabled for this app." }, 403);
		}

		// STDB handles encryption atomically — pass plaintext
		const secret = await SecretService.createSecret({
			key,
			org_id,
			value: value || "",
			app_id,
			env_type_id,
		});
		secretOperations.add(1, { operation: "created" });

		// Create PiT record
		await SecretStorePiTService.createSecretStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message: change_message || `Created secret ${key}`,
			user_id,
			envs: [
				{
					key,
					value: value || "",
					operation: "CREATE",
				},
			],
		});

		// Log the creation of the secret
		await AuditLogService.notifyAuditSystem({
			action: "secret_created",
			org_id,
			user_id,
			message: `Secret ${key} created with PiT tracking in app ${app_id} for environment type ${env_type_id}.`,
			details: {
				secret_id: secret.id,
				key,
				app_id,
				env_type_id,
			},
		});

		return c.json(secret, 201);
	};

	public static readonly updateSecret = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { key } = c.req.param();
		const { value, app_id, env_type_id, change_message } = await c.req.json();

		if (!key || !org_id || !app_id || !env_type_id) {
			return c.json({ error: "key, org_id, app_id, and env_type_id are required." }, 400);
		}

		// env_type_id
		const env_type = await EnvTypeService.getEnvType(env_type_id);

		const canEdit = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to perform this action." }, 403);
		}

		const existingSecret = await SecretService.getSecret({
			app_id,
			env_type_id,
			key,
			org_id,
		});

		if (!existingSecret) {
			return c.json({ error: "Secret does not exist." }, 404);
		}

		const app = await AppService.getApp({
			id: app_id,
		});
		if (!app) {
			return c.json({ error: "App not found." }, 404);
		}

		// Check if the app belongs to the organization
		if (app.org_id !== org_id) {
			return c.json({ error: "App does not belong to the organization." }, 403);
		}
		if (!app.enable_secrets) {
			return c.json({ error: "Secrets are not enabled for this app." }, 403);
		}

		// STDB handles encryption atomically — pass plaintext
		await SecretService.updateSecret({
			key,
			org_id,
			value: value || "",
			app_id,
			env_type_id,
		});

		// Create PiT record
		await SecretStorePiTService.createSecretStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message: change_message || `Updated secret ${key}`,
			user_id,
			envs: [
				{
					key,
					value: value || "",
					operation: "UPDATE",
				},
			],
		});

		// Log the update of the secret
		await AuditLogService.notifyAuditSystem({
			action: "secret_updated",
			org_id,
			user_id,
			message: `Secret ${key} updated with PiT tracking in app ${app_id} for environment type ${env_type_id}.`,
			details: {
				key,
				app_id,
				env_type_id,
			},
		});

		return c.json({ message: "Secret updated successfully with PiT tracking" });
	};

	public static readonly deleteSecret = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { app_id, env_type_id, key, change_message } = await c.req.json();

		if (!org_id || !app_id || !env_type_id || !key) {
			return c.json({ error: "org_id, app_id, env_type_id, and key are required." }, 400);
		}

		// env_type_id
		const env_type = await EnvTypeService.getEnvType(env_type_id);

		const canEdit = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_edit", "env_type", env_type_id);
		if (!canEdit) {
			return c.json({ error: "You do not have permission to perform this action." }, 403);
		}

		// Get the existing secret before deletion for PiT record
		const existingSecret = await SecretService.getSecret({
			app_id,
			env_type_id,
			key,
			org_id,
		});

		if (!existingSecret) {
			return c.json({ error: "Secret does not exist." }, 404);
		}

		// Delete the secret
		await SecretService.deleteSecret({
			app_id,
			env_type_id,
			key,
			org_id,
		});

		// Create PiT record
		await SecretStorePiTService.createSecretStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message: change_message || `Deleted secret ${key}`,
			user_id,
			envs: [
				{
					key,
					value: existingSecret.value,
					operation: "DELETE",
				},
			],
		});

		// Log the deletion of the secret
		await AuditLogService.notifyAuditSystem({
			action: "secret_deleted",
			org_id,
			user_id,
			message: `Secret ${key} deleted with PiT tracking from app ${app_id} for environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				key,
			},
		});

		return c.json({ message: "Secret deleted successfully with PiT tracking" });
	};

	public static readonly batchCreateSecrets = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		let { app_id, env_type_id, envs, change_message } = await c.req.json();

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

		const app = await AppService.getApp({
			id: app_id,
		});
		if (!app) {
			return c.json({ error: "App not found." }, 404);
		}

		// Check if the app belongs to the organization
		if (app.org_id !== org_id) {
			return c.json({ error: "App does not belong to the organization." }, 403);
		}

		if (!app.enable_secrets) {
			return c.json({ error: "Secrets are not enabled for this app." }, 403);
		}

		// Check if any of the secrets already exist
		const existingSecrets = await Promise.all(
			envs.map(env =>
				SecretService.getSecret({
					app_id,
					env_type_id,
					key: env.key,
					org_id,
				}),
			),
		);

		const existingKeys = existingSecrets.filter(secret => secret).map(secret => secret!.key);

		if (existingKeys.length > 0) {
			return c.json({ error: `Secrets already exist for keys: ${existingKeys.join(", ")}` }, 400);
		}

		// STDB handles encryption atomically — pass plaintext
		await SecretService.batchCreateSecrets(org_id, app_id, env_type_id, envs);
		secretOperations.add(envs.length, { operation: "created" });

		// Create PiT record
		await SecretStorePiTService.createSecretStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message:
				change_message ||
				`Batch created ${envs.length} secrets: ${envs.map(env => env.key).join(", ")}`,
			user_id,
			envs: envs.map((env: { key: string; value: string }) => ({
				key: env.key,
				value: env.value || "",
				operation: "CREATE" as const,
			})),
		});

		// Log the batch creation of secrets
		await AuditLogService.notifyAuditSystem({
			action: "secrets_batch_created",
			org_id,
			user_id,
			message: `Batch creation of ${envs.length} secrets with PiT tracking in app ${app_id} for environment type ${env_type_id} for keys: ${envs.map(env => env.key).join(", ")}.`,
			details: {
				app_id,
				env_type_id,
				env_count: envs.length,
				keys: envs.map(env => env.key),
			},
		});

		return c.json({ message: "Secrets created successfully with PiT tracking" }, 201);
	};

	public static readonly batchUpdateSecrets = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { app_id, env_type_id, envs, change_message } = await c.req.json();

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

		const app = await AppService.getApp({
			id: app_id,
		});
		if (!app) {
			return c.json({ error: "App not found." }, 404);
		}

		// Check if the app belongs to the organization
		if (app.org_id !== org_id) {
			return c.json({ error: "App does not belong to the organization." }, 403);
		}

		if (!app.enable_secrets) {
			return c.json({ error: "Secrets are not enabled for this app." }, 403);
		}

		// Check if all secrets exist
		const existingSecrets = await Promise.all(
			envs.map(env =>
				SecretService.getSecret({
					app_id,
					env_type_id,
					key: env.key,
					org_id,
				}),
			),
		);

		const nonExistingKeys = envs
			.filter((env, index) => !existingSecrets[index])
			.map(env => env.key);

		if (nonExistingKeys.length > 0) {
			return c.json(
				{ error: `Secrets do not exist for keys: ${nonExistingKeys.join(", ")}` },
				400,
			);
		}

		// STDB handles encryption atomically — pass plaintext
		await SecretService.batchUpdateSecrets(org_id, app_id, env_type_id, envs);

		// Create PiT record
		await SecretStorePiTService.createSecretStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message:
				change_message ||
				`Batch updated ${envs.length} secrets: ${envs.map(env => env.key).join(", ")}`,
			user_id,
			envs: envs.map((env: { key: string; value: string }) => ({
				key: env.key,
				value: env.value || "",
				operation: "UPDATE" as const,
			})),
		});

		// Log the batch update of secrets
		await AuditLogService.notifyAuditSystem({
			action: "secrets_batch_updated",
			org_id,
			user_id,
			message: `Batch update of ${envs.length} secrets with PiT tracking in app ${app_id} for environment type ${env_type_id} for keys: ${envs.map(env => env.key).join(", ")}.`,
			details: {
				app_id,
				env_type_id,
				env_count: envs.length,
				keys: envs.map(env => env.key),
			},
		});

		return c.json({ message: "Secrets updated successfully with PiT tracking" }, 200);
	};

	public static readonly batchDeleteSecrets = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { app_id, env_type_id, keys, change_message } = await c.req.json();

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

		// Get existing secrets before deletion for PiT record
		const existingSecrets = await Promise.all(
			keys.map(key =>
				SecretService.getSecret({
					app_id,
					env_type_id,
					key,
					org_id,
				}),
			),
		);

		const secretsToDelete = existingSecrets.filter(secret => secret);
		const nonExistingKeys = keys.filter((key, index) => !existingSecrets[index]);

		if (nonExistingKeys.length > 0) {
			return c.json(
				{ error: `Secrets do not exist for keys: ${nonExistingKeys.join(", ")}` },
				400,
			);
		}

		// Delete secrets
		await SecretService.batchDeleteSecrets(org_id, app_id, env_type_id, keys);

		// Create PiT record
		await SecretStorePiTService.createSecretStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message:
				change_message || `Batch deleted ${secretsToDelete.length} secrets: ${keys.join(", ")}`,
			user_id,
			envs: secretsToDelete.map(secret => ({
				key: secret!.key,
				value: secret!.value,
				operation: "DELETE" as const,
			})),
		});

		// Log the batch deletion of secrets
		await AuditLogService.notifyAuditSystem({
			action: "secrets_batch_deleted",
			org_id,
			user_id,
			message: `Batch deletion of ${secretsToDelete.length} secrets with PiT tracking in app ${app_id} for environment type ${env_type_id} for keys: ${keys.join(", ")}.`,
			details: {
				app_id,
				env_type_id,
				keys,
			},
		});

		return c.json({ message: "Secrets deleted successfully with PiT tracking" }, 200);
	};

	public static readonly getSecrets = async (c: Context) => {
		const org_id = c.get("org_id");
		const { app_id, env_type_id } = await c.req.json();

		if (!org_id || !app_id || !env_type_id) {
			return c.json({ error: "org_id, app_id, and env_type_id are required." }, 400);
		}

		const canView = await AuthorizationService.check(c.get("user_id"), "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		// Get the app
		const app = await AppService.getApp({
			id: app_id,
		});
		if (!app) {
			return c.json({ error: "App not found." }, 404);
		}

		// Check if the app belongs to the organization
		if (app.org_id !== org_id) {
			return c.json({ error: "App does not belong to the organization." }, 403);
		}

		// STDB returns decrypted values directly
		const secrets = await SecretService.getAllSecret({
			app_id,
			env_type_id,
			org_id,
		});
		secretOperations.add(secrets.length, { operation: "decrypted" });

		return c.json(secrets);
	};

	public static readonly getSecret = async (c: Context) => {
		const org_id = c.get("org_id");
		const { app_id, env_type_id, key } = c.req.param();

		if (!org_id || !app_id || !env_type_id || !key) {
			return c.json({ error: "org_id, app_id, env_type_id, and key are required." }, 400);
		}

		const canView = await AuthorizationService.check(c.get("user_id"), "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		// Get the app
		const app = await AppService.getApp({
			id: app_id,
		});
		if (!app) {
			return c.json({ error: "App not found." }, 404);
		}

		// Check if the app belongs to the organization
		if (app.org_id !== org_id) {
			return c.json({ error: "App does not belong to the organization." }, 403);
		}

		// STDB returns decrypted values directly
		const secret = await SecretService.getSecret({
			key,
			app_id,
			env_type_id,
			org_id,
		});

		if (!secret) {
			return c.json({ error: "Secret not found." }, 404);
		}

		secretOperations.add(1, { operation: "decrypted" });
		return c.json(secret);
	};

	public static readonly getSecretHistory = async (c: Context) => {
		const org_id = c.get("org_id");
		const { app_id, env_type_id, page, per_page } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id) {
			return c.json({ error: "org_id, app_id, and env_type_id are required." }, 400);
		}

		// Check env type permissions
		const env_type = await EnvTypeService.getEnvType(env_type_id);
		const canView = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		const result = await SecretStorePiTService.getSecretStorePiTs({
			org_id,
			app_id,
			env_type_id,
			page,
			per_page,
		});

		// Log the retrieval of secret history
		await AuditLogService.notifyAuditSystem({
			action: "secret_history_viewed",
			org_id,
			user_id: c.get("user_id"),
			message: `Secret history viewed for app ${app_id} and environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				page,
				per_page,
			},
		});

		return c.json(result);
	};

	public static readonly getSecretsAtPointInTime = async (c: Context) => {
		const org_id = c.get("org_id");
		const { app_id, env_type_id, pit_id } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id || !pit_id) {
			return c.json({ error: "org_id, app_id, env_type_id, and pit_id are required." }, 400);
		}

		// Check env type permissions
		const env_type = await EnvTypeService.getEnvType(env_type_id);
		const canView = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		const secrets = await SecretStorePiTService.getEnvsTillPiTId({
			org_id,
			app_id,
			env_type_id,
			secret_store_pit_id: pit_id,
		});

		// Log the retrieval
		await AuditLogService.notifyAuditSystem({
			action: "secrets_pit_viewed",
			org_id,
			user_id: c.get("user_id"),
			message: `Secrets at point in time ${pit_id} viewed for app ${app_id} and environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				pit_id,
			},
		});

		return c.json(secrets);
	};

	public static readonly getSecretsAtTimestamp = async (c: Context) => {
		const org_id = c.get("org_id");
		const { app_id, env_type_id, timestamp } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id || !timestamp) {
			return c.json({ error: "org_id, app_id, env_type_id, and timestamp are required." }, 400);
		}

		// Check env type permissions
		const env_type = await EnvTypeService.getEnvType(env_type_id);
		const canView = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		// Validate timestamp
		const targetTimestamp = new Date(timestamp);
		if (isNaN(targetTimestamp.getTime())) {
			return c.json({ error: "Invalid timestamp format." }, 400);
		}

		const secrets = await SecretStorePiTService.getEnvsTillTimestamp({
			org_id,
			app_id,
			env_type_id,
			timestamp: targetTimestamp,
		});

		// Log the retrieval
		await AuditLogService.notifyAuditSystem({
			action: "secrets_timestamp_viewed",
			org_id,
			user_id: c.get("user_id"),
			message: `Secrets at timestamp ${targetTimestamp.toISOString()} viewed for app ${app_id} and environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				timestamp: targetTimestamp.toISOString(),
			},
		});

		return c.json(secrets);
	};

	public static readonly getSecretDiff = async (c: Context) => {
		const org_id = c.get("org_id");
		const { app_id, env_type_id, from_pit_id, to_pit_id } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id || !from_pit_id || !to_pit_id) {
			return c.json(
				{ error: "org_id, app_id, env_type_id, from_pit_id, and to_pit_id are required." },
				400,
			);
		}

		// Check env type permissions
		const env_type = await EnvTypeService.getEnvType(env_type_id);
		const canView = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		const diff = await SecretStorePiTService.getEnvDiff({
			org_id,
			app_id,
			env_type_id,
			from_pit_id,
			to_pit_id,
		});

		// Log the retrieval
		await AuditLogService.notifyAuditSystem({
			action: "secret_diff_viewed",
			org_id,
			user_id: c.get("user_id"),
			message: `Secret diff viewed between ${from_pit_id} and ${to_pit_id} for app ${app_id} and environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				from_pit_id,
				to_pit_id,
			},
		});

		return c.json(diff);
	};

	public static readonly getSecretVariableTimeline = async (c: Context) => {
		const org_id = c.get("org_id");
		const { key } = c.req.param();
		const { app_id, env_type_id, limit } = c.req.valid("json" as never);

		if (!org_id || !app_id || !env_type_id || !key) {
			return c.json({ error: "org_id, app_id, env_type_id, and key are required." }, 400);
		}

		// Check env type permissions
		const env_type = await EnvTypeService.getEnvType(env_type_id);
		const canView = await AuthorizationService.check(c.get("user_id"), env_type.is_protected ? "can_manage_protected" : "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		const timeline = await SecretStorePiTService.getVariableTimeline({
			org_id,
			app_id,
			env_type_id,
			key,
			limit,
		});

		// Log the retrieval
		await AuditLogService.notifyAuditSystem({
			action: "secret_timeline_viewed",
			org_id,
			user_id: c.get("user_id"),
			message: `Secret timeline for ${key} viewed in app ${app_id} and environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				key,
				limit,
			},
		});

		return c.json(timeline);
	};

	public static readonly rollbackSecretsToPitId = async (c: Context) => {
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

		const app = await AppService.getApp({
			id: app_id,
		});
		if (!app) {
			return c.json({ error: "App not found." }, 404);
		}

		if (app.org_id !== org_id) {
			return c.json({ error: "App does not belong to the organization." }, 403);
		}

		if (!app.enable_secrets) {
			return c.json({ error: "Secrets are not enabled for this app." }, 403);
		}

		// Get current state for comparison
		const currentSecrets = await SecretService.getAllSecret({
			app_id,
			env_type_id,
			org_id,
		});

		// Get target state from PiT (values from PiT records)
		const targetSecrets = await SecretStorePiTService.getEnvsTillPiTId({
			org_id,
			app_id,
			env_type_id,
			secret_store_pit_id: pit_id,
		});

		// Create maps for comparison (values are encrypted)
		const currentMap = new Map(currentSecrets.map(secret => [secret.key, secret.value]));
		const targetMap = new Map(targetSecrets.map(secret => [secret.key, secret.value]));

		const rollbackOperations: Array<{
			key: string;
			value: string;
			operation: "CREATE" | "UPDATE" | "DELETE";
		}> = [];

		// Find secrets to delete (exist in current but not in target)
		for (const [key] of currentMap) {
			if (!targetMap.has(key)) {
				await SecretService.deleteSecret({
					key,
					app_id,
					env_type_id,
					org_id,
				});
				rollbackOperations.push({
					key,
					value: "",
					operation: "DELETE" as const,
				});
			}
		}

		// Find secrets to create or update (values are already encrypted from PiT)
		for (const [key, value] of targetMap) {
			if (!currentMap.has(key)) {
				await SecretService.createSecret({
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
				await SecretService.updateSecret({
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
			await SecretStorePiTService.createSecretStorePiT({
				org_id,
				app_id,
				env_type_id,
				change_request_message:
					rollback_message ||
					`Rollback to PiT ${pit_id}: ${rollbackOperations.length} secrets affected`,
				user_id,
				envs: rollbackOperations,
			});

			// Log the rollback operation
			await AuditLogService.notifyAuditSystem({
				action: "secrets_rollback_pit",
				org_id,
				user_id,
				message: `Secrets rolled back to PiT ${pit_id} in app ${app_id} for environment type ${env_type_id}.`,
				details: {
					app_id,
					env_type_id,
					pit_id,
					operations_performed: rollbackOperations.length,
				},
			});
		}

		return c.json({
			message: "Rollback completed successfully",
			operations_performed: rollbackOperations.length,
		});
	};

	public static readonly rollbackSecretsToTimestamp = async (c: Context) => {
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

		const app = await AppService.getApp({
			id: app_id,
		});
		if (!app) {
			return c.json({ error: "App not found." }, 404);
		}

		if (app.org_id !== org_id) {
			return c.json({ error: "App does not belong to the organization." }, 403);
		}

		if (!app.enable_secrets) {
			return c.json({ error: "Secrets are not enabled for this app." }, 403);
		}

		// Get current state for comparison
		const currentSecrets = await SecretService.getAllSecret({
			app_id,
			env_type_id,
			org_id,
		});

		// Get target state from timestamp (values are encrypted from PiT)
		const targetSecrets = await SecretStorePiTService.getEnvsTillTimestamp({
			org_id,
			app_id,
			env_type_id,
			timestamp: targetTimestamp,
		});

		// Create maps for comparison (values are encrypted)
		const currentMap = new Map(currentSecrets.map(secret => [secret.key, secret.value]));
		const targetMap = new Map(targetSecrets.map(secret => [secret.key, secret.value]));

		const rollbackOperations: Array<{
			key: string;
			value: string;
			operation: "CREATE" | "UPDATE" | "DELETE";
		}> = [];

		// Find secrets to delete (exist in current but not in target)
		for (const [key] of currentMap) {
			if (!targetMap.has(key)) {
				await SecretService.deleteSecret({
					key,
					app_id,
					env_type_id,
					org_id,
				});
				rollbackOperations.push({
					key,
					value: "",
					operation: "DELETE" as const,
				});
			}
		}

		// Find secrets to create or update (values are already encrypted from PiT)
		for (const [key, value] of targetMap) {
			if (!currentMap.has(key)) {
				await SecretService.createSecret({
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
				await SecretService.updateSecret({
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
			await SecretStorePiTService.createSecretStorePiT({
				org_id,
				app_id,
				env_type_id,
				change_request_message:
					rollback_message ||
					`Rollback to ${targetTimestamp.toISOString()}: ${rollbackOperations.length} secrets affected`,
				user_id,
				envs: rollbackOperations,
			});

			// Log the rollback operation
			await AuditLogService.notifyAuditSystem({
				action: "secrets_rollback_timestamp",
				org_id,
				user_id,
				message: `Secrets rolled back to timestamp ${targetTimestamp.toISOString()} in app ${app_id} for environment type ${env_type_id}.`,
				details: {
					app_id,
					env_type_id,
					timestamp: targetTimestamp.toISOString(),
					operations_performed: rollbackOperations.length,
				},
			});
		}

		return c.json({
			message: "Rollback completed successfully",
			operations_performed: rollbackOperations.length,
			target_timestamp: targetTimestamp.toISOString(),
		});
	};

	public static readonly rollbackSecretVariableToPitId = async (c: Context) => {
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

		const app = await AppService.getApp({
			id: app_id,
		});
		if (!app) {
			return c.json({ error: "App not found." }, 404);
		}

		if (app.org_id !== org_id) {
			return c.json({ error: "App does not belong to the organization." }, 403);
		}

		if (!app.enable_secrets) {
			return c.json({ error: "Secrets are not enabled for this app." }, 403);
		}

		// Get current variable state
		const currentSecret = await SecretService.getSecret({
			key,
			app_id,
			env_type_id,
			org_id,
		});

		// Get target state from PiT (values from PiT records)
		const targetSecrets = await SecretStorePiTService.getEnvsTillPiTId({
			org_id,
			app_id,
			env_type_id,
			secret_store_pit_id: pit_id,
		});

		// Find the specific variable in target state
		const targetSecret = targetSecrets.find(secret => secret.key === key);
		let rollbackOperation: {
			key: string;
			value: string;
			operation: "CREATE" | "UPDATE" | "DELETE";
		} | null = null;

		if (!targetSecret && currentSecret) {
			await SecretService.deleteSecret({
				key,
				app_id,
				env_type_id,
				org_id,
			});
			rollbackOperation = {
				key,
				value: "",
				operation: "DELETE" as const,
			};
		} else if (targetSecret && !currentSecret) {
			await SecretService.createSecret({
				key,
				value: targetSecret.value,
				app_id,
				env_type_id,
				org_id,
			});
			rollbackOperation = {
				key,
				value: targetSecret.value,
				operation: "CREATE" as const,
			};
		} else if (targetSecret && currentSecret && targetSecret.value !== currentSecret.value) {
			await SecretService.updateSecret({
				key,
				value: targetSecret.value,
				app_id,
				env_type_id,
				org_id,
			});
			rollbackOperation = {
				key,
				value: targetSecret.value,
				operation: "UPDATE" as const,
			};
		} else {
			return c.json({
				message: "No rollback needed - secret is already at target state",
				key,
			});
		}

		// Create PiT record for rollback operation
		await SecretStorePiTService.createSecretStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message:
				rollback_message || `Rollback secret ${key} to PiT ${pit_id}`,
			user_id,
			envs: [rollbackOperation],
		});

		// Log the rollback operation
		await AuditLogService.notifyAuditSystem({
			action: "secret_variable_rollback_pit",
			org_id,
			user_id,
			message: `Secret variable ${key} rolled back to PiT ${pit_id} in app ${app_id} for environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				key,
				pit_id,
				operation: rollbackOperation.operation,
			},
		});

		return c.json({
			message: "Secret variable rollback completed successfully",
			key,
			operation: rollbackOperation.operation,
			pit_id,
		});
	};

	public static readonly rollbackSecretVariableToTimestamp = async (c: Context) => {
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

		const app = await AppService.getApp({
			id: app_id,
		});
		if (!app) {
			return c.json({ error: "App not found." }, 404);
		}

		if (app.org_id !== org_id) {
			return c.json({ error: "App does not belong to the organization." }, 403);
		}

		if (!app.enable_secrets) {
			return c.json({ error: "Secrets are not enabled for this app." }, 403);
		}

		// Get current variable state
		const currentSecret = await SecretService.getSecret({
			key,
			app_id,
			env_type_id,
			org_id,
		});

		// Get target state from timestamp (values from PiT records)
		const targetSecrets = await SecretStorePiTService.getEnvsTillTimestamp({
			org_id,
			app_id,
			env_type_id,
			timestamp: targetTimestamp,
		});

		// Find the specific variable in target state
		const targetSecret = targetSecrets.find(secret => secret.key === key);
		let rollbackOperation: {
			key: string;
			value: string;
			operation: "CREATE" | "UPDATE" | "DELETE";
		} | null = null;

		if (!targetSecret && currentSecret) {
			await SecretService.deleteSecret({
				key,
				app_id,
				env_type_id,
				org_id,
			});
			rollbackOperation = {
				key,
				value: "",
				operation: "DELETE" as const,
			};
		} else if (targetSecret && !currentSecret) {
			await SecretService.createSecret({
				key,
				value: targetSecret.value,
				app_id,
				env_type_id,
				org_id,
			});
			rollbackOperation = {
				key,
				value: targetSecret.value,
				operation: "CREATE" as const,
			};
		} else if (targetSecret && currentSecret && targetSecret.value !== currentSecret.value) {
			await SecretService.updateSecret({
				key,
				value: targetSecret.value,
				app_id,
				env_type_id,
				org_id,
			});
			rollbackOperation = {
				key,
				value: targetSecret.value,
				operation: "UPDATE" as const,
			};
		} else {
			return c.json({
				message: "No rollback needed - secret is already at target state",
				key,
				target_timestamp: targetTimestamp.toISOString(),
			});
		}

		// Create PiT record for rollback operation
		await SecretStorePiTService.createSecretStorePiT({
			org_id,
			app_id,
			env_type_id,
			change_request_message:
				rollback_message || `Rollback secret ${key} to ${targetTimestamp.toISOString()}`,
			user_id,
			envs: [rollbackOperation],
		});

		// Log the rollback operation
		await AuditLogService.notifyAuditSystem({
			action: "secret_variable_rollback_timestamp",
			org_id,
			user_id,
			message: `Secret variable ${key} rolled back to timestamp ${targetTimestamp.toISOString()} in app ${app_id} for environment type ${env_type_id}.`,
			details: {
				app_id,
				env_type_id,
				key,
				timestamp: targetTimestamp.toISOString(),
				operation: rollbackOperation.operation,
			},
		});

		return c.json({
			message: "Secret variable rollback completed successfully",
			key,
			operation: rollbackOperation.operation,
			target_timestamp: targetTimestamp.toISOString(),
		});
	};

	public static readonly revealSecret = async (c: Context) => {
		const org_id = c.get("org_id");
		const { app_id, env_type_id, keys } = await c.req.json();

		if (!org_id || !app_id || !env_type_id || !keys) {
			return c.json({ error: "org_id, app_id, env_type_id, and keys are required." }, 400);
		}

		const canView = await AuthorizationService.check(c.get("user_id"), "can_view", "env_type", env_type_id);
		if (!canView) {
			return c.json({ error: "You do not have permission to view this environment." }, 403);
		}

		// Get the app
		const app = await AppService.getApp({
			id: app_id,
		});
		if (!app) {
			return c.json({ error: "App not found." }, 404);
		}

		// Check if the app belongs to the organization
		if (app.org_id !== org_id) {
			return c.json({ error: "App does not belong to the organization." }, 403);
		}

		// Only managed secrets can be revealed server-side
		if (!app.is_managed_secret) {
			return c.json({ error: "Cannot reveal secrets for non-managed apps. Decrypt client-side with your own key." }, 403);
		}

		// STDB returns decrypted values directly — filter by requested keys
		const secrets = await SecretService.getAllSecret({
			app_id,
			env_type_id,
			org_id,
		});

		if (!secrets) {
			return c.json({ error: "Secret not found." }, 404);
		}

		const filteredSecrets = secrets.filter(secret => keys.includes(secret.key));
		secretOperations.add(filteredSecrets.length, { operation: "decrypted" });

		return c.json(filteredSecrets);
	};
}

import { SecretStorePiTService } from "@/services/secret_store_pit.service";
import { type Context } from "hono";

import { SecretService } from "@/services/secret.service";
import { AuditLogService } from "@/services/audit_log.service";
import { EnvTypeService } from "@/services/env_type.service";
import { AppService } from "@/services/app.service";
import { smartDecrypt, smartEncrypt } from "@/helpers/key-store";

export class SecretController {
	public static readonly createSecret = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");

			const { key, value, app_id, env_type_id, change_message } = await c.req.json();

			if (!key || !org_id || !app_id || !env_type_id) {
				return c.json({ error: "key, org_id, app_id, and env_type_id are required." }, 400);
			}

			const permissions = c.get("permissions");

			// env_type_id
			const env_type = await EnvTypeService.getEnvType(env_type_id);

			// env_type's name is "Production", user must have admin permissions
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json(
					{ error: "You do not have permission to create secrets in Production." },
					403,
				);
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

			// permissions.can_edit is true, user can create secrets
			if (!permissions.can_edit) {
				return c.json({ error: "You do not have permission to create secrets." }, 403);
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

			if (!app.enable_secrets || !app.public_key) {
				return c.json({ error: "Secrets are not enabled for this app." }, 403);
			}

			// Create the secret
			const secret = await SecretService.createSecret({
				key,
				org_id,
				value: smartEncrypt(value || "", app.public_key),
				app_id,
				env_type_id,
			});

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
						value: smartEncrypt(value || "", app.public_key),
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
		} catch (err) {
			if (err instanceof Error) {
				if (
					err.message.includes("already exists as a secret") ||
					err.message.includes("already exists as an environment variable")
				) {
					return c.json({ error: err.message }, 409);
				}

				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly updateSecret = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const { key } = c.req.param();
			const { value, app_id, env_type_id, change_message } = await c.req.json();

			if (!key || !org_id || !app_id || !env_type_id) {
				return c.json({ error: "key, org_id, app_id, and env_type_id are required." }, 400);
			}

			const permissions = c.get("permissions");

			// env_type_id
			const env_type = await EnvTypeService.getEnvType(env_type_id);

			// env_type's name is "Production", user must have admin permissions
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json(
					{ error: "You do not have permission to update secrets in Production." },
					403,
				);
			}

			// permissions.can_edit is true, user can update secrets
			if (!permissions.can_edit) {
				return c.json({ error: "You do not have permission to update secrets." }, 403);
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
			if (!app.enable_secrets || !app.public_key) {
				return c.json({ error: "Secrets are not enabled for this app." }, 403);
			}

			const encryptedValue = smartEncrypt(value || "", app.public_key);

			// Update the secret
			await SecretService.updateSecret({
				key,
				org_id,
				value: encryptedValue,
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
						value: encryptedValue,
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
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly deleteSecret = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const { app_id, env_type_id, key, change_message } = await c.req.json();

			if (!org_id || !app_id || !env_type_id || !key) {
				return c.json({ error: "org_id, app_id, env_type_id, and key are required." }, 400);
			}

			const permissions = c.get("permissions");

			// env_type_id
			const env_type = await EnvTypeService.getEnvType(env_type_id);

			// env_type's name is "Production", user must have admin permissions
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json(
					{ error: "You do not have permission to delete secrets in Production." },
					403,
				);
			}

			// permissions.can_edit is true, user can delete secrets
			if (!permissions.can_edit) {
				return c.json({ error: "You do not have permission to delete secrets." }, 403);
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
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly batchCreateSecrets = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			let { app_id, env_type_id, envs, change_message } = await c.req.json();

			if (!envs || !Array.isArray(envs)) {
				return c.json({ error: "envs must be an array." }, 400);
			}

			const permissions = c.get("permissions");

			// env_type_id
			const env_type = await EnvTypeService.getEnvType(env_type_id);

			// env_type's name is "Production", user must have admin permissions
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json(
					{ error: "You do not have permission to create secrets in Production." },
					403,
				);
			}

			// permissions.can_edit is true, user can create secrets
			if (!permissions.can_edit) {
				return c.json({ error: "You do not have permission to create secrets." }, 403);
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

			if (!app.enable_secrets || !app.public_key) {
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

			// Encrypt the values before storing
			let modEnvs = envs.map(env => ({
				...env,
				value: smartEncrypt(env.value || "", app.public_key!),
			}));

			// Create secrets
			await SecretService.batchCreateSecrets(org_id, app_id, env_type_id, modEnvs);

			// Create PiT record
			await SecretStorePiTService.createSecretStorePiT({
				org_id,
				app_id,
				env_type_id,
				change_request_message:
					change_message ||
					`Batch created ${modEnvs.length} secrets: ${modEnvs.map(env => env.key).join(", ")}`,
				user_id,
				envs: modEnvs.map(env => ({
					key: env.key,
					value: env.value,
					operation: "CREATE" as const,
				})),
			});

			// Log the batch creation of secrets
			await AuditLogService.notifyAuditSystem({
				action: "secrets_batch_created",
				org_id,
				user_id,
				message: `Batch creation of ${modEnvs.length} secrets with PiT tracking in app ${app_id} for environment type ${env_type_id} for keys: ${modEnvs.map(env => env.key).join(", ")}.`,
				details: {
					app_id,
					env_type_id,
					env_count: modEnvs.length,
					keys: modEnvs.map(env => env.key),
				},
			});

			return c.json({ message: "Secrets created successfully with PiT tracking" }, 201);
		} catch (err) {
			if (err instanceof Error) {
				if (
					err.message.includes("already exists as a secret") ||
					err.message.includes("already exists as an environment variable")
				) {
					return c.json({ error: err.message }, 409);
				}

				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly batchUpdateSecrets = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const { app_id, env_type_id, envs, change_message } = await c.req.json();

			if (!envs || !Array.isArray(envs)) {
				return c.json({ error: "envs must be an array." }, 400);
			}

			const permissions = c.get("permissions");

			// env_type_id
			const env_type = await EnvTypeService.getEnvType(env_type_id);

			// env_type's name is "Production", user must have admin permissions
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json(
					{ error: "You do not have permission to update secrets in Production." },
					403,
				);
			}

			// permissions.can_edit is true, user can edit secrets
			if (!permissions.can_edit) {
				return c.json({ error: "You do not have permission to edit secrets." }, 403);
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

			if (!app.enable_secrets || !app.public_key) {
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

			// Encrypt the values before storing
			const modEnvs = envs.map(env => ({
				...env,
				value: smartEncrypt(env.value || "", app.public_key!),
			}));

			// Update secrets
			await SecretService.batchUpdateSecrets(org_id, app_id, env_type_id, modEnvs);

			// Create PiT record
			await SecretStorePiTService.createSecretStorePiT({
				org_id,
				app_id,
				env_type_id,
				change_request_message:
					change_message ||
					`Batch updated ${modEnvs.length} secrets: ${modEnvs.map(env => env.key).join(", ")}`,
				user_id,
				envs: modEnvs.map(env => ({
					key: env.key,
					value: env.value,
					operation: "UPDATE" as const,
				})),
			});

			// Log the batch update of secrets
			await AuditLogService.notifyAuditSystem({
				action: "secrets_batch_updated",
				org_id,
				user_id,
				message: `Batch update of ${modEnvs.length} secrets with PiT tracking in app ${app_id} for environment type ${env_type_id} for keys: ${modEnvs.map(env => env.key).join(", ")}.`,
				details: {
					app_id,
					env_type_id,
					env_count: modEnvs.length,
					keys: modEnvs.map(env => env.key),
				},
			});

			return c.json({ message: "Secrets updated successfully with PiT tracking" }, 200);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly batchDeleteSecrets = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const { app_id, env_type_id, keys, change_message } = await c.req.json();

			if (!keys || !Array.isArray(keys)) {
				return c.json({ error: "keys must be an array." }, 400);
			}

			const permissions = c.get("permissions");

			// env_type_id
			const env_type = await EnvTypeService.getEnvType(env_type_id);

			// env_type's name is "Production", user must have admin permissions
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json(
					{ error: "You do not have permission to delete secrets in Production." },
					403,
				);
			}

			// permissions.can_edit is true, user can delete secrets
			if (!permissions.can_edit) {
				return c.json({ error: "You do not have permission to delete secrets." }, 403);
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
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getSecrets = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const { app_id, env_type_id } = await c.req.json();

			if (!org_id || !app_id || !env_type_id) {
				return c.json({ error: "org_id, app_id, and env_type_id are required." }, 400);
			}

			const permissions = c.get("permissions");

			// Check if the user has permission to reveal secrets
			if (!permissions.can_view) {
				return c.json({ error: "You do not have permission to reveal secrets." }, 403);
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

			// Get the secrets
			const secrets = await SecretService.getAllSecret({
				app_id,
				env_type_id,
				org_id,
			});

			return c.json(secrets);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getSecret = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const { app_id, env_type_id, key } = c.req.param();

			if (!org_id || !app_id || !env_type_id || !key) {
				return c.json({ error: "org_id, app_id, env_type_id, and key are required." }, 400);
			}

			const permissions = c.get("permissions");

			// Check if the user has permission to reveal secrets
			if (!permissions.can_view) {
				return c.json({ error: "You do not have permission to reveal secrets." }, 403);
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

			// Get the secret
			const secret = await SecretService.getSecret({
				key,
				app_id,
				env_type_id,
				org_id,
			});

			if (!secret) {
				return c.json({ error: "Secret not found." }, 404);
			}

			return c.json(secret);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getSecretHistory = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const { app_id, env_type_id, page = 1, per_page = 20 } = await c.req.json();

			if (!org_id || !app_id || !env_type_id) {
				return c.json({ error: "org_id, app_id, and env_type_id are required." }, 400);
			}

			const permissions = c.get("permissions");

			// Check env type permissions
			const env_type = await EnvTypeService.getEnvType(env_type_id);
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json(
					{ error: "You do not have permission to view secret history in Production." },
					403,
				);
			}

			// Check view permissions
			if (!permissions.can_view) {
				return c.json({ error: "You do not have permission to view secret history." }, 403);
			}

			const result = await SecretStorePiTService.getSecretStorePiTs({
				org_id,
				app_id,
				env_type_id,
				page: parseInt(page as string),
				per_page: parseInt(per_page as string),
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
					page: parseInt(page as string),
					per_page: parseInt(per_page as string),
				},
			});

			return c.json(result);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getSecretsAtPointInTime = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const { app_id, env_type_id, pit_id } = await c.req.json();

			if (!org_id || !app_id || !env_type_id || !pit_id) {
				return c.json({ error: "org_id, app_id, env_type_id, and pit_id are required." }, 400);
			}

			const permissions = c.get("permissions");

			// Check env type permissions
			const env_type = await EnvTypeService.getEnvType(env_type_id);
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json({ error: "You do not have permission to view secrets in Production." }, 403);
			}

			// Check view permissions
			if (!permissions.can_view) {
				return c.json({ error: "You do not have permission to view secrets." }, 403);
			}

			const secrets = await SecretStorePiTService.getEnvsTillPiTId({
				org_id,
				app_id,
				env_type_id,
				secret_store_pit_id: pit_id as string,
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
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getSecretsAtTimestamp = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const { app_id, env_type_id, timestamp } = await c.req.json();

			if (!org_id || !app_id || !env_type_id || !timestamp) {
				return c.json({ error: "org_id, app_id, env_type_id, and timestamp are required." }, 400);
			}

			const permissions = c.get("permissions");

			// Check env type permissions
			const env_type = await EnvTypeService.getEnvType(env_type_id);
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json({ error: "You do not have permission to view secrets in Production." }, 403);
			}

			// Check view permissions
			if (!permissions.can_view) {
				return c.json({ error: "You do not have permission to view secrets." }, 403);
			}

			// Validate timestamp
			const targetTimestamp = new Date(timestamp as string);
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
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getSecretDiff = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const { app_id, env_type_id, from_pit_id, to_pit_id } = await c.req.json();

			if (!org_id || !app_id || !env_type_id || !from_pit_id || !to_pit_id) {
				return c.json(
					{ error: "org_id, app_id, env_type_id, from_pit_id, and to_pit_id are required." },
					400,
				);
			}

			const permissions = c.get("permissions");

			// Check env type permissions
			const env_type = await EnvTypeService.getEnvType(env_type_id);
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json(
					{ error: "You do not have permission to view secret diffs in Production." },
					403,
				);
			}

			// Check view permissions
			if (!permissions.can_view) {
				return c.json({ error: "You do not have permission to view secret diffs." }, 403);
			}

			const diff = await SecretStorePiTService.getEnvDiff({
				org_id,
				app_id,
				env_type_id,
				from_pit_id: from_pit_id as string,
				to_pit_id: to_pit_id as string,
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
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly getSecretVariableTimeline = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const { key } = c.req.param();
			const { app_id, env_type_id, limit = "50" } = await c.req.json();

			if (!org_id || !app_id || !env_type_id || !key) {
				return c.json({ error: "org_id, app_id, env_type_id, and key are required." }, 400);
			}

			const permissions = c.get("permissions");

			// Check env type permissions
			const env_type = await EnvTypeService.getEnvType(env_type_id);
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json(
					{ error: "You do not have permission to view secret timeline in Production." },
					403,
				);
			}

			// Check view permissions
			if (!permissions.can_view) {
				return c.json({ error: "You do not have permission to view secret timeline." }, 403);
			}

			const timeline = await SecretStorePiTService.getVariableTimeline({
				org_id,
				app_id,
				env_type_id,
				key,
				limit: parseInt(limit as string),
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
					limit: parseInt(limit as string),
				},
			});

			return c.json(timeline);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly rollbackSecretsToPitId = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const { app_id, env_type_id, pit_id, rollback_message } = await c.req.json();

			if (!org_id || !app_id || !env_type_id || !pit_id) {
				return c.json({ error: "org_id, app_id, env_type_id, and pit_id are required." }, 400);
			}

			const permissions = c.get("permissions");

			// Check env type permissions
			const env_type = await EnvTypeService.getEnvType(env_type_id);
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json(
					{ error: "You do not have permission to rollback secrets in Production." },
					403,
				);
			}

			// Check edit permissions
			if (!permissions.can_edit) {
				return c.json({ error: "You do not have permission to rollback secrets." }, 403);
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

			if (!app.enable_secrets || !app.public_key) {
				return c.json({ error: "Secrets are not enabled for this app." }, 403);
			}

			// Get current state for comparison
			const currentSecrets = await SecretService.getAllSecret({
				app_id,
				env_type_id,
				org_id,
			});

			// Get target state from PiT
			const targetSecrets = await SecretStorePiTService.getEnvsTillPiTId({
				org_id,
				app_id,
				env_type_id,
				secret_store_pit_id: pit_id,
			});

			// Create maps for comparison
			const currentMap = new Map(currentSecrets.map(secret => [secret.key, secret.value]));
			const targetMap = new Map(targetSecrets.map(secret => [secret.key, secret.value]));

			const rollbackOperations = [];

			// Find secrets to delete (exist in current but not in target)
			for (const [key, value] of currentMap) {
				if (!targetMap.has(key)) {
					await SecretService.deleteSecret({
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

			// Find secrets to create or update
			for (const [key, value] of targetMap) {
				if (!currentMap.has(key)) {
					// Create new secret
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
					// Update existing secret
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
						operations: rollbackOperations,
					},
				});
			}

			return c.json({
				message: "Rollback completed successfully",
				operations_performed: rollbackOperations.length,
				operations: rollbackOperations,
			});
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly rollbackSecretsToTimestamp = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const { app_id, env_type_id, timestamp, rollback_message } = await c.req.json();

			if (!org_id || !app_id || !env_type_id || !timestamp) {
				return c.json({ error: "org_id, app_id, env_type_id, and timestamp are required." }, 400);
			}

			const permissions = c.get("permissions");

			// Check env type permissions
			const env_type = await EnvTypeService.getEnvType(env_type_id);
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json(
					{ error: "You do not have permission to rollback secrets in Production." },
					403,
				);
			}

			// Check edit permissions
			if (!permissions.can_edit) {
				return c.json({ error: "You do not have permission to rollback secrets." }, 403);
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

			if (!app.enable_secrets || !app.public_key) {
				return c.json({ error: "Secrets are not enabled for this app." }, 403);
			}

			// Get current state for comparison
			const currentSecrets = await SecretService.getAllSecret({
				app_id,
				env_type_id,
				org_id,
			});

			// Get target state from timestamp
			const targetSecrets = await SecretStorePiTService.getEnvsTillTimestamp({
				org_id,
				app_id,
				env_type_id,
				timestamp: targetTimestamp,
			});

			// Create maps for comparison
			const currentMap = new Map(currentSecrets.map(secret => [secret.key, secret.value]));
			const targetMap = new Map(targetSecrets.map(secret => [secret.key, secret.value]));

			const rollbackOperations = [];

			// Find secrets to delete (exist in current but not in target)
			for (const [key, value] of currentMap) {
				if (!targetMap.has(key)) {
					await SecretService.deleteSecret({
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

			// Find secrets to create or update
			for (const [key, value] of targetMap) {
				if (!currentMap.has(key)) {
					// Create new secret
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
					// Update existing secret
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
						operations: rollbackOperations,
					},
				});
			}

			return c.json({
				message: "Rollback completed successfully",
				operations_performed: rollbackOperations.length,
				operations: rollbackOperations,
				target_timestamp: targetTimestamp.toISOString(),
			});
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly rollbackSecretVariableToPitId = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const { key } = c.req.param();
			const { app_id, env_type_id, pit_id, rollback_message } = await c.req.json();

			if (!org_id || !app_id || !env_type_id || !pit_id || !key) {
				return c.json({ error: "org_id, app_id, env_type_id, pit_id, and key are required." }, 400);
			}

			const permissions = c.get("permissions");

			// Check env type permissions
			const env_type = await EnvTypeService.getEnvType(env_type_id);
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json(
					{ error: "You do not have permission to rollback secrets in Production." },
					403,
				);
			}

			// Check edit permissions
			if (!permissions.can_edit) {
				return c.json({ error: "You do not have permission to rollback secrets." }, 403);
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

			if (!app.enable_secrets || !app.public_key) {
				return c.json({ error: "Secrets are not enabled for this app." }, 403);
			}

			// Get current variable state
			const currentSecret = await SecretService.getSecret({
				key,
				app_id,
				env_type_id,
				org_id,
			});

			// Get target state from PiT
			const targetSecrets = await SecretStorePiTService.getEnvsTillPiTId({
				org_id,
				app_id,
				env_type_id,
				secret_store_pit_id: pit_id,
			});

			// Find the specific variable in target state
			const targetSecret = targetSecrets.find(secret => secret.key === key);
			let rollbackOperation = null;

			if (!targetSecret && currentSecret) {
				// Variable exists now but didn't exist at target PiT - DELETE it
				await SecretService.deleteSecret({
					key,
					app_id,
					env_type_id,
					org_id,
				});
				rollbackOperation = {
					key,
					value: currentSecret.value,
					operation: "DELETE" as const,
					previous_value: currentSecret.value,
					target_value: null,
				};
			} else if (targetSecret && !currentSecret) {
				// Variable didn't exist now but existed at target PiT - CREATE it
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
					previous_value: null,
					target_value: targetSecret.value,
				};
			} else if (targetSecret && currentSecret && targetSecret.value !== currentSecret.value) {
				// Variable exists in both but values differ - UPDATE it
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
					previous_value: currentSecret.value,
					target_value: targetSecret.value,
				};
			} else {
				// No changes needed
				return c.json({
					message: "No rollback needed - secret is already at target state",
					key,
					current_value: currentSecret?.value || null,
					target_value: targetSecret?.value || null,
				});
			}

			// Create PiT record for rollback operation
			await SecretStorePiTService.createSecretStorePiT({
				org_id,
				app_id,
				env_type_id,
				change_request_message:
					rollback_message ||
					`Rollback secret ${key} to PiT ${pit_id}: ${rollbackOperation.previous_value} → ${rollbackOperation.target_value}`,
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
					previous_value: rollbackOperation.previous_value,
					target_value: rollbackOperation.target_value,
				},
			});

			return c.json({
				message: "Secret variable rollback completed successfully",
				key,
				operation: rollbackOperation.operation,
				previous_value: rollbackOperation.previous_value,
				target_value: rollbackOperation.target_value,
				pit_id,
			});
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly rollbackSecretVariableToTimestamp = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const user_id = c.get("user_id");
			const { key } = c.req.param();
			const { app_id, env_type_id, timestamp, rollback_message } = await c.req.json();

			if (!org_id || !app_id || !env_type_id || !timestamp || !key) {
				return c.json(
					{ error: "org_id, app_id, env_type_id, timestamp, and key are required." },
					400,
				);
			}

			const permissions = c.get("permissions");

			// Check env type permissions
			const env_type = await EnvTypeService.getEnvType(env_type_id);
			if (env_type.is_protected && (!permissions.is_admin || !permissions.is_master)) {
				return c.json(
					{ error: "You do not have permission to rollback secrets in Production." },
					403,
				);
			}

			// Check edit permissions
			if (!permissions.can_edit) {
				return c.json({ error: "You do not have permission to rollback secrets." }, 403);
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

			if (!app.enable_secrets || !app.public_key) {
				return c.json({ error: "Secrets are not enabled for this app." }, 403);
			}

			// Get current variable state
			const currentSecret = await SecretService.getSecret({
				key,
				app_id,
				env_type_id,
				org_id,
			});

			// Get target state from timestamp
			const targetSecrets = await SecretStorePiTService.getEnvsTillTimestamp({
				org_id,
				app_id,
				env_type_id,
				timestamp: targetTimestamp,
			});

			// Find the specific variable in target state
			const targetSecret = targetSecrets.find(secret => secret.key === key);
			let rollbackOperation = null;

			if (!targetSecret && currentSecret) {
				// Variable exists now but didn't exist at target timestamp - DELETE it
				await SecretService.deleteSecret({
					key,
					app_id,
					env_type_id,
					org_id,
				});
				rollbackOperation = {
					key,
					value: currentSecret.value,
					operation: "DELETE" as const,
					previous_value: currentSecret.value,
					target_value: null,
				};
			} else if (targetSecret && !currentSecret) {
				// Variable didn't exist now but existed at target timestamp - CREATE it
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
					previous_value: null,
					target_value: targetSecret.value,
				};
			} else if (targetSecret && currentSecret && targetSecret.value !== currentSecret.value) {
				// Variable exists in both but values differ - UPDATE it
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
					previous_value: currentSecret.value,
					target_value: targetSecret.value,
				};
			} else {
				// No changes needed
				return c.json({
					message: "No rollback needed - secret is already at target state",
					key,
					current_value: currentSecret?.value || null,
					target_value: targetSecret?.value || null,
					target_timestamp: targetTimestamp.toISOString(),
				});
			}

			// Create PiT record for rollback operation
			await SecretStorePiTService.createSecretStorePiT({
				org_id,
				app_id,
				env_type_id,
				change_request_message:
					rollback_message ||
					`Rollback secret ${key} to ${targetTimestamp.toISOString()}: ${rollbackOperation.previous_value} → ${rollbackOperation.target_value}`,
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
					previous_value: rollbackOperation.previous_value,
					target_value: rollbackOperation.target_value,
				},
			});

			return c.json({
				message: "Secret variable rollback completed successfully",
				key,
				operation: rollbackOperation.operation,
				previous_value: rollbackOperation.previous_value,
				target_value: rollbackOperation.target_value,
				target_timestamp: targetTimestamp.toISOString(),
			});
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly revealSecret = async (c: Context) => {
		try {
			const org_id = c.get("org_id");
			const { app_id, env_type_id, keys } = await c.req.json();

			if (!org_id || !app_id || !env_type_id || !keys) {
				return c.json({ error: "org_id, app_id, env_type_id, and keys are required." }, 400);
			}

			const permissions = c.get("permissions");

			// Check if the user has permission to reveal secrets
			if (!permissions.can_view) {
				return c.json({ error: "You do not have permission to reveal secrets." }, 403);
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

			// Get the secret
			const secrets = await SecretService.getAllSecret({
				app_id,
				env_type_id,
				org_id,
			});

			if (!secrets) {
				return c.json({ error: "Secret not found." }, 404);
			}

			// Filter secrets by keys
			const filteredSecrets = secrets.filter(secret => keys.includes(secret.key));

			const appPrivateKey = await AppService.getManagedAppPrivateKey(app_id);

			// Decrypt the secret values
			const decryptedSecrets = filteredSecrets.map(secret => ({
				...secret,
				value: smartDecrypt(secret.value, appPrivateKey!),
			}));

			return c.json(decryptedSecrets);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};
}

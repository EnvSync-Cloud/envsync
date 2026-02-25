import { ConflictError, NotFoundError } from "@/libs/errors";
import { STDBClient } from "@/libs/stdb";

import { KeyValidationService } from "./key_validation.service";

/**
 * Synthesize a response object matching the previous PG row shape.
 */
function toSecretRecord(
	org_id: string,
	app_id: string,
	env_type_id: string,
	key: string,
	value: string,
	created_at: string,
) {
	return {
		id: `${org_id}:${app_id}:${env_type_id}:${key}`,
		org_id,
		app_id,
		env_type_id,
		key,
		value,
		created_at: new Date(Number(created_at) / 1000),
		updated_at: new Date(Number(created_at) / 1000),
	};
}

export class SecretService {
	public static createSecret = async ({
		key,
		value,
		env_type_id,
		app_id,
		org_id,
	}: {
		key: string;
		value: string;
		env_type_id: string;
		app_id: string;
		org_id: string;
	}) => {
		const keyCheck = await KeyValidationService.checkKeyExists({
			key,
			app_id,
			env_type_id,
			org_id,
			excludeTable: "secret_store",
		});

		if (keyCheck.exists) {
			throw new ConflictError(keyCheck.message!);
		}

		const stdb = STDBClient.getInstance();
		await stdb.callReducer("create_secret", [org_id, app_id, env_type_id, key, value]);

		return { id: `${org_id}:${app_id}:${env_type_id}:${key}` };
	};

	public static getSecret = async ({
		key,
		env_type_id,
		app_id,
		org_id,
	}: {
		key: string;
		env_type_id: string;
		app_id: string;
		org_id: string;
	}) => {
		const stdb = STDBClient.getInstance();
		try {
			const resultJson = await stdb.callReducer<string>("get_secret", [org_id, app_id, env_type_id, key]);
			const result = JSON.parse(resultJson);

			return toSecretRecord(
				org_id,
				app_id,
				env_type_id,
				result.key,
				result.value,
				result.created_at,
			);
		} catch (err: any) {
			if (err?.stdbMessage?.includes("not found")) {
				return undefined;
			}
			throw err;
		}
	};

	public static updateSecret = async ({
		key,
		value,
		app_id,
		org_id,
		env_type_id,
	}: {
		key: string;
		value: string;
		app_id: string;
		org_id: string;
		env_type_id: string;
	}) => {
		const stdb = STDBClient.getInstance();
		try {
			await stdb.callReducer("update_secret", [org_id, app_id, env_type_id, key, value]);
		} catch (err: any) {
			if (err?.stdbMessage?.includes("not found")) {
				throw new NotFoundError("Secret", key);
			}
			throw err;
		}
	};

	public static deleteSecret = async ({
		key,
		app_id,
		env_type_id,
		org_id,
	}: {
		key: string;
		app_id: string;
		env_type_id: string;
		org_id: string;
	}) => {
		const stdb = STDBClient.getInstance();
		try {
			await stdb.callReducer("delete_secret", [org_id, app_id, env_type_id, key], { injectRootKey: false });
		} catch (err: any) {
			if (err?.stdbMessage?.includes("not found")) {
				throw new NotFoundError("Secret", key);
			}
			throw err;
		}
	};

	public static getAllSecret = async ({
		app_id,
		org_id,
		env_type_id,
	}: {
		app_id: string;
		org_id: string;
		env_type_id: string;
	}) => {
		const stdb = STDBClient.getInstance();
		const resultJson = await stdb.callReducer<string>("list_secrets", [org_id, app_id, env_type_id]);
		const results: { key: string; value: string; created_at: string }[] = JSON.parse(resultJson);

		return results.map(r =>
			toSecretRecord(org_id, app_id, env_type_id, r.key, r.value, r.created_at),
		);
	};

	public static batchCreateSecrets = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		envs: { key: string; value: string }[],
	) => {
		const keys = envs.map(env => env.key);
		const conflicts = await KeyValidationService.validateKeys({
			keys,
			app_id,
			env_type_id,
			org_id,
			excludeTable: "secret_store",
		});

		if (conflicts.length > 0) {
			const conflictMessages = conflicts.map(c => c.message).join(", ");
			throw new ConflictError(`Key conflicts found: ${conflictMessages}`);
		}

		const stdb = STDBClient.getInstance();
		const itemsJson = JSON.stringify(envs);
		await stdb.callReducer("batch_create_secrets", [org_id, app_id, env_type_id, itemsJson]);
	};

	public static batchUpdateSecrets = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		envs: { key: string; value: string }[],
	) => {
		const stdb = STDBClient.getInstance();
		const itemsJson = JSON.stringify(envs);
		await stdb.callReducer("batch_update_secrets", [org_id, app_id, env_type_id, itemsJson]);
	};

	public static batchDeleteSecrets = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		keys: string[],
	) => {
		const stdb = STDBClient.getInstance();
		const keysJson = JSON.stringify(keys);
		await stdb.callReducer("batch_delete_secrets", [org_id, app_id, env_type_id, keysJson], { injectRootKey: false });
	};

	public static getAppSecretSummary = async ({
		app_id,
		org_id,
	}: {
		app_id: string;
		org_id: string;
	}) => {
		const stdb = STDBClient.getInstance();
		const envTypes = await stdb.query<{ uuid: string }>(
			`SELECT uuid FROM env_type WHERE app_id = '${app_id}' AND org_id = '${org_id}'`,
		);

		const summary = await Promise.all(
			envTypes.map(async et => {
				const resultJson = await stdb.callReducer<string>(
					"list_keys_in_scope",
					[org_id, app_id, et.uuid],
					{ injectRootKey: false },
				);
				const result = JSON.parse(resultJson);
				return { env_type_id: et.uuid, count: result.secret_keys.length };
			}),
		);

		return summary;
	};
}

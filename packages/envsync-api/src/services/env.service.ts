import { ConflictError, NotFoundError } from "@/libs/errors";
import { variableOperations } from "@/libs/telemetry/metrics";
import { STDBClient } from "@/libs/stdb";

import { KeyValidationService } from "./key_validation.service";

/**
 * Synthesize a response object matching the previous PG row shape.
 */
function toEnvRecord(
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

export class EnvService {
	public static createEnv = async ({
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
			excludeTable: "env_store",
		});

		if (keyCheck.exists) {
			throw new ConflictError(keyCheck.message!);
		}

		const stdb = STDBClient.getInstance();
		await stdb.callReducer("create_env", [org_id, app_id, env_type_id, key, value]);
		variableOperations.add(1, { operation: "encrypted" });
		variableOperations.add(1, { operation: "created" });

		return { id: `${org_id}:${app_id}:${env_type_id}:${key}` };
	};

	public static getEnv = async ({
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
			const resultJson = await stdb.callReducer<string>("get_env", [org_id, app_id, env_type_id, key]);
			const result = JSON.parse(resultJson);
			variableOperations.add(1, { operation: "decrypted" });

			return toEnvRecord(
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

	public static updateEnv = async ({
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
			await stdb.callReducer("update_env", [org_id, app_id, env_type_id, key, value]);
			variableOperations.add(1, { operation: "encrypted" });
		} catch (err: any) {
			if (err?.stdbMessage?.includes("not found")) {
				throw new NotFoundError("Env", key);
			}
			throw err;
		}
	};

	public static deleteEnv = async ({
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
			await stdb.callReducer("delete_env", [org_id, app_id, env_type_id, key], { injectRootKey: false });
		} catch (err: any) {
			if (err?.stdbMessage?.includes("not found")) {
				throw new NotFoundError("Env", key);
			}
			throw err;
		}
	};

	public static getAllEnv = async ({
		app_id,
		org_id,
		env_type_id,
	}: {
		app_id: string;
		org_id: string;
		env_type_id: string;
	}) => {
		const stdb = STDBClient.getInstance();
		const resultJson = await stdb.callReducer<string>("list_envs", [org_id, app_id, env_type_id]);
		const results: { key: string; value: string; created_at: string }[] = JSON.parse(resultJson);
		variableOperations.add(results.length, { operation: "decrypted" });

		return results.map(r =>
			toEnvRecord(org_id, app_id, env_type_id, r.key, r.value, r.created_at),
		);
	};

	public static batchCreateEnvs = async (
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
			excludeTable: "env_store",
		});

		if (conflicts.length > 0) {
			const conflictMessages = conflicts.map(c => c.message).join(", ");
			throw new ConflictError(`Key conflicts found: ${conflictMessages}`);
		}

		const stdb = STDBClient.getInstance();
		const itemsJson = JSON.stringify(envs);
		await stdb.callReducer("batch_create_envs", [org_id, app_id, env_type_id, itemsJson]);
		variableOperations.add(envs.length, { operation: "encrypted" });
		variableOperations.add(envs.length, { operation: "created" });
	};

	public static batchUpdateEnvs = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		envs: { key: string; value: string }[],
	) => {
		const stdb = STDBClient.getInstance();
		const itemsJson = JSON.stringify(envs);
		await stdb.callReducer("batch_update_envs", [org_id, app_id, env_type_id, itemsJson]);
		variableOperations.add(envs.length, { operation: "encrypted" });
	};

	public static batchDeleteEnvs = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		keys: string[],
	) => {
		const stdb = STDBClient.getInstance();
		const keysJson = JSON.stringify(keys);
		await stdb.callReducer("batch_delete_envs", [org_id, app_id, env_type_id, keysJson], { injectRootKey: false });
	};

	public static getAppEnvSummary = async ({
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
				return { env_type_id: et.uuid, count: result.env_keys.length };
			}),
		);

		return summary;
	};
}

import { DB } from "@/libs/db";
import { VaultClient } from "@/libs/vault";
import { secretPath, secretScopePath } from "@/libs/vault/paths";

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
	created_time: string,
) {
	return {
		id: `${org_id}:${app_id}:${env_type_id}:${key}`,
		org_id,
		app_id,
		env_type_id,
		key,
		value,
		created_at: new Date(created_time),
		updated_at: new Date(created_time),
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
			throw new Error(keyCheck.message!);
		}

		const vault = await VaultClient.getInstance();
		const path = secretPath(org_id, app_id, env_type_id, key);
		const result = await vault.kvWrite(path, { value });

		return { id: `${org_id}:${app_id}:${env_type_id}:${key}`, vault_version: result.version };
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
		const vault = await VaultClient.getInstance();
		const path = secretPath(org_id, app_id, env_type_id, key);
		const result = await vault.kvRead(path);

		if (!result) {
			return undefined;
		}

		return toSecretRecord(
			org_id,
			app_id,
			env_type_id,
			key,
			result.data.value,
			result.metadata.created_time,
		);
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
		const vault = await VaultClient.getInstance();
		const path = secretPath(org_id, app_id, env_type_id, key);

		const existing = await vault.kvRead(path);
		if (!existing) {
			throw new Error("no result");
		}

		const result = await vault.kvWrite(path, { value });
		return { vault_version: result.version };
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
		const vault = await VaultClient.getInstance();
		const path = secretPath(org_id, app_id, env_type_id, key);

		const existing = await vault.kvRead(path);
		if (!existing) {
			throw new Error("no result");
		}

		await vault.kvMetadataDelete(path);
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
		const vault = await VaultClient.getInstance();
		const scopePath = secretScopePath(org_id, app_id, env_type_id);
		const keys = await vault.kvList(scopePath);

		if (keys.length === 0) {
			return [];
		}

		const results = await Promise.all(
			keys.map(async key => {
				const path = secretPath(org_id, app_id, env_type_id, key);
				const result = await vault.kvRead(path);
				if (!result) return null;
				return toSecretRecord(
					org_id,
					app_id,
					env_type_id,
					key,
					result.data.value,
					result.metadata.created_time,
				);
			}),
		);

		return results.filter(r => r !== null);
	};

	public static batchCreateSecrets = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		envs: {
			key: string;
			value: string;
		}[],
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
			throw new Error(`Key conflicts found: ${conflictMessages}`);
		}

		const vault = await VaultClient.getInstance();

		const results = await Promise.all(
			envs.map(async env => {
				const path = secretPath(org_id, app_id, env_type_id, env.key);
				const result = await vault.kvWrite(path, { value: env.value });
				return { key: env.key, vault_version: result.version };
			}),
		);

		return results;
	};

	public static batchUpdateSecrets = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		envs: {
			key: string;
			value: string;
		}[],
	) => {
		const vault = await VaultClient.getInstance();

		const results = await Promise.all(
			envs.map(async env => {
				const path = secretPath(org_id, app_id, env_type_id, env.key);
				const result = await vault.kvWrite(path, { value: env.value });
				return { key: env.key, vault_version: result.version };
			}),
		);

		return results;
	};

	public static batchDeleteSecrets = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		keys: string[],
	) => {
		const vault = await VaultClient.getInstance();

		await Promise.all(
			keys.map(key => {
				const path = secretPath(org_id, app_id, env_type_id, key);
				return vault.kvMetadataDelete(path);
			}),
		);
	};

	public static getAppSecretSummary = async ({
		app_id,
		org_id,
	}: {
		app_id: string;
		org_id: string;
	}) => {
		const db = await DB.getInstance();
		const envTypes = await db
			.selectFrom("env_type")
			.select("id")
			.where("app_id", "=", app_id)
			.where("org_id", "=", org_id)
			.execute();

		const vault = await VaultClient.getInstance();

		const summary = await Promise.all(
			envTypes.map(async et => {
				const scopePath = secretScopePath(org_id, app_id, et.id);
				const keys = await vault.kvList(scopePath);
				return { env_type_id: et.id, count: keys.length };
			}),
		);

		return summary;
	};
}

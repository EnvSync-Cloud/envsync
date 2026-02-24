import { DB } from "@/libs/db";
import { ConflictError, NotFoundError, ValidationError } from "@/libs/errors";
import { variableOperations } from "@/libs/telemetry/metrics";
import { VaultClient } from "@/libs/vault";
import { envPath, envScopePath } from "@/libs/vault/paths";
import { kmsEncrypt, kmsDecrypt, kmsBatchEncrypt } from "@/helpers/key-store";

import { KeyValidationService } from "./key_validation.service";

/** Simple concurrency limiter for parallel operations. */
function pLimit(concurrency: number) {
	let active = 0;
	const queue: (() => void)[] = [];
	const next = () => { if (queue.length > 0 && active < concurrency) { active++; queue.shift()!(); } };
	return <T>(fn: () => Promise<T>): Promise<T> =>
		new Promise<T>((resolve, reject) => {
			const run = () => fn().then(resolve, reject).finally(() => { active--; next(); });
			queue.push(run);
			next();
		});
}

const limit = pLimit(10);

/**
 * Synthesize a response object matching the previous PG row shape.
 */
function toEnvRecord(
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

/**
 * Build the AAD string for env variable encryption.
 */
function envAAD(org_id: string, app_id: string, env_type_id: string, key: string): string {
	return `env:${org_id}:${app_id}:${env_type_id}:${key}`;
}

/**
 * Decrypt a KMS-encrypted value read from Vault.
 * All values must be KMS-encrypted (KMS:v1: prefix).
 */
async function decryptEnvValue(
	org_id: string,
	app_id: string,
	env_type_id: string,
	key: string,
	value: string,
): Promise<string> {
	if (!value.startsWith("KMS:v1:")) {
		throw new ValidationError(`Env value for key "${key}" is not KMS-encrypted.`);
	}
	const aad = envAAD(org_id, app_id, env_type_id, key);
	const decrypted = await kmsDecrypt(org_id, app_id, value, aad);
	variableOperations.add(1, { operation: "decrypted" });
	return decrypted;
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

		// Encrypt via miniKMS before writing to Vault
		const aad = envAAD(org_id, app_id, env_type_id, key);
		const encryptedValue = await kmsEncrypt(org_id, app_id, value, aad);
		variableOperations.add(1, { operation: "encrypted" });

		const vault = await VaultClient.getInstance();
		const path = envPath(org_id, app_id, env_type_id, key);
		await vault.kvWrite(path, { value: encryptedValue });
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
		const vault = await VaultClient.getInstance();
		const path = envPath(org_id, app_id, env_type_id, key);
		const result = await vault.kvRead(path);

		if (!result) {
			return undefined;
		}

		// Decrypt value transparently
		const decryptedValue = await decryptEnvValue(
			org_id, app_id, env_type_id, key, result.data.value,
		);

		return toEnvRecord(
			org_id,
			app_id,
			env_type_id,
			key,
			decryptedValue,
			result.metadata.created_time,
		);
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
		const vault = await VaultClient.getInstance();
		const path = envPath(org_id, app_id, env_type_id, key);

		// Verify the key exists before updating
		const existing = await vault.kvRead(path);
		if (!existing) {
			throw new NotFoundError("Env", key);
		}

		// Encrypt via miniKMS before writing to Vault
		const aad = envAAD(org_id, app_id, env_type_id, key);
		const encryptedValue = await kmsEncrypt(org_id, app_id, value, aad);
		variableOperations.add(1, { operation: "encrypted" });

		await vault.kvWrite(path, { value: encryptedValue });
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
		const vault = await VaultClient.getInstance();
		const path = envPath(org_id, app_id, env_type_id, key);

		// Verify the key exists before deleting
		const existing = await vault.kvRead(path);
		if (!existing) {
			throw new NotFoundError("Env", key);
		}

		await vault.kvMetadataDelete(path);
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
		const vault = await VaultClient.getInstance();
		const scopePath = envScopePath(org_id, app_id, env_type_id);
		const keys = await vault.kvList(scopePath);

		if (keys.length === 0) {
			return [];
		}

		const results = await Promise.all(
			keys.map(key => limit(async () => {
				const path = envPath(org_id, app_id, env_type_id, key);
				const result = await vault.kvRead(path);
				if (!result) return null;

				// Decrypt value transparently
				const decryptedValue = await decryptEnvValue(
					org_id, app_id, env_type_id, key, result.data.value,
				);

				return toEnvRecord(
					org_id,
					app_id,
					env_type_id,
					key,
					decryptedValue,
					result.metadata.created_time,
				);
			})),
		);

		return results.filter(r => r !== null);
	};

	public static batchCreateEnvs = async (
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
			excludeTable: "env_store",
		});

		if (conflicts.length > 0) {
			const conflictMessages = conflicts.map(c => c.message).join(", ");
			throw new ConflictError(`Key conflicts found: ${conflictMessages}`);
		}

		const vault = await VaultClient.getInstance();

		// Batch encrypt all values via miniKMS in a single call, then write to Vault
		const encryptedValues = await kmsBatchEncrypt(
			org_id,
			app_id,
			envs.map(env => ({
				value: env.value,
				aad: envAAD(org_id, app_id, env_type_id, env.key),
			})),
		);
		variableOperations.add(envs.length, { operation: "encrypted" });

		await Promise.all(
			envs.map((env, i) => limit(() => {
				const path = envPath(org_id, app_id, env_type_id, env.key);
				return vault.kvWrite(path, { value: encryptedValues[i] });
			})),
		);
		variableOperations.add(envs.length, { operation: "created" });
	};

	public static batchUpdateEnvs = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		envs: {
			key: string;
			value: string;
		}[],
	) => {
		const vault = await VaultClient.getInstance();

		// Batch encrypt all values via miniKMS in a single call, then write to Vault
		const encryptedValues = await kmsBatchEncrypt(
			org_id,
			app_id,
			envs.map(env => ({
				value: env.value,
				aad: envAAD(org_id, app_id, env_type_id, env.key),
			})),
		);
		variableOperations.add(envs.length, { operation: "encrypted" });

		await Promise.all(
			envs.map((env, i) => limit(() => {
				const path = envPath(org_id, app_id, env_type_id, env.key);
				return vault.kvWrite(path, { value: encryptedValues[i] });
			})),
		);
	};

	public static batchDeleteEnvs = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		keys: string[],
	) => {
		const vault = await VaultClient.getInstance();

		await Promise.all(
			keys.map(key => limit(() => {
				const path = envPath(org_id, app_id, env_type_id, key);
				return vault.kvMetadataDelete(path);
			})),
		);
	};

	public static getAppEnvSummary = async ({
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
				const scopePath = envScopePath(org_id, app_id, et.id);
				const keys = await vault.kvList(scopePath);
				return { env_type_id: et.id, count: keys.length };
			}),
		);

		return summary;
	};
}

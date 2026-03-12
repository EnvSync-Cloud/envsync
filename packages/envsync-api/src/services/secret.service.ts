import * as grpc from "@grpc/grpc-js";

import { DB } from "@/libs/db";
import { ConflictError, NotFoundError } from "@/libs/errors";
import { KMSClient } from "@/libs/kms/client";
import { getVaultSessionToken } from "@/libs/kms/session-manager";

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
		created_at: created_at ? new Date(Number(created_at) * 1000) : new Date(),
		updated_at: created_at ? new Date(Number(created_at) * 1000) : new Date(),
	};
}

export class SecretService {
	public static createSecret = async ({
		key,
		value,
		env_type_id,
		app_id,
		org_id,
		user_id,
	}: {
		key: string;
		value: string;
		env_type_id: string;
		app_id: string;
		org_id: string;
		user_id: string;
	}) => {
		const keyCheck = await KeyValidationService.checkKeyExists({
			key,
			app_id,
			env_type_id,
			org_id,
			user_id,
			excludeTable: "secret_store",
		});

		if (keyCheck.exists) {
			throw new ConflictError(keyCheck.message!);
		}

		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(user_id, org_id);
		const result = await kms.vaultWrite(
			{
				orgId: org_id,
				scopeId: app_id,
				entryType: "secret",
				key,
				envTypeId: env_type_id,
				value: Buffer.from(value, "utf-8"),
				createdBy: user_id,
			},
			sessionToken,
		);

		return { id: `${org_id}:${app_id}:${env_type_id}:${key}`, vault_version: result.version };
	};

	public static getSecret = async ({
		key,
		env_type_id,
		app_id,
		org_id,
		user_id,
	}: {
		key: string;
		env_type_id: string;
		app_id: string;
		org_id: string;
		user_id: string;
	}) => {
		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(user_id, org_id);

		try {
			const result = await kms.vaultRead(
				{ orgId: org_id, scopeId: app_id, entryType: "secret", key, envTypeId: env_type_id, clientSideDecrypt: false },
				sessionToken,
			);

			return toSecretRecord(
				org_id,
				app_id,
				env_type_id,
				key,
				result.encryptedValue.toString("utf-8"),
				result.createdAt,
			);
		} catch (err) {
			const isNotFound = err instanceof Error && "code" in err && (
				(err as grpc.ServiceError).code === grpc.status.NOT_FOUND ||
				((err as grpc.ServiceError).code === grpc.status.INTERNAL && err.message.includes("vault entry not found"))
			);
			if (isNotFound) {
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
		user_id,
	}: {
		key: string;
		value: string;
		app_id: string;
		org_id: string;
		env_type_id: string;
		user_id: string;
	}) => {
		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(user_id, org_id);

		// Verify exists
		try {
			await kms.vaultRead(
				{ orgId: org_id, scopeId: app_id, entryType: "secret", key, envTypeId: env_type_id },
				sessionToken,
			);
		} catch (err) {
			const isNotFound = err instanceof Error && "code" in err && (
				(err as grpc.ServiceError).code === grpc.status.NOT_FOUND ||
				((err as grpc.ServiceError).code === grpc.status.INTERNAL && err.message.includes("vault entry not found"))
			);
			if (isNotFound) {
				throw new NotFoundError("Secret", key);
			}
			throw err;
		}

		const result = await kms.vaultWrite(
			{
				orgId: org_id,
				scopeId: app_id,
				entryType: "secret",
				key,
				envTypeId: env_type_id,
				value: Buffer.from(value, "utf-8"),
				createdBy: user_id,
			},
			sessionToken,
		);
		return { vault_version: result.version };
	};

	public static deleteSecret = async ({
		key,
		app_id,
		env_type_id,
		org_id,
		user_id,
	}: {
		key: string;
		app_id: string;
		env_type_id: string;
		org_id: string;
		user_id: string;
	}) => {
		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(user_id, org_id);

		// Verify exists
		try {
			await kms.vaultRead(
				{ orgId: org_id, scopeId: app_id, entryType: "secret", key, envTypeId: env_type_id },
				sessionToken,
			);
		} catch (err) {
			const isNotFound = err instanceof Error && "code" in err && (
				(err as grpc.ServiceError).code === grpc.status.NOT_FOUND ||
				((err as grpc.ServiceError).code === grpc.status.INTERNAL && err.message.includes("vault entry not found"))
			);
			if (isNotFound) {
				throw new NotFoundError("Secret", key);
			}
			throw err;
		}

		await kms.vaultDestroy(org_id, app_id, "secret", key, env_type_id, 0, sessionToken);
	};

	public static getAllSecret = async ({
		app_id,
		org_id,
		env_type_id,
		user_id,
	}: {
		app_id: string;
		org_id: string;
		env_type_id: string;
		user_id: string;
	}) => {
		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(user_id, org_id);
		const entries = await kms.vaultList(org_id, app_id, "secret", env_type_id, sessionToken);

		if (entries.length === 0) {
			return [];
		}

		const results = await Promise.all(
			entries.map(entry => limit(async () => {
				try {
					const result = await kms.vaultRead(
						{ orgId: org_id, scopeId: app_id, entryType: "secret", key: entry.key, envTypeId: env_type_id, clientSideDecrypt: false },
						sessionToken,
					);
					return toSecretRecord(org_id, app_id, env_type_id, entry.key, result.encryptedValue.toString("utf-8"), result.createdAt);
				} catch {
					return null;
				}
			})),
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
		user_id: string,
	) => {
		const keys = envs.map(env => env.key);
		const conflicts = await KeyValidationService.validateKeys({
			keys,
			app_id,
			env_type_id,
			org_id,
			user_id,
			excludeTable: "secret_store",
		});

		if (conflicts.length > 0) {
			const conflictMessages = conflicts.map(c => c.message).join(", ");
			throw new ConflictError(`Key conflicts found: ${conflictMessages}`);
		}

		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(user_id, org_id);

		const results = await Promise.all(
			envs.map(env => limit(async () => {
				const result = await kms.vaultWrite(
					{
						orgId: org_id,
						scopeId: app_id,
						entryType: "secret",
						key: env.key,
						envTypeId: env_type_id,
						value: Buffer.from(env.value, "utf-8"),
						createdBy: user_id,
					},
					sessionToken,
				);
				return { key: env.key, vault_version: result.version };
			})),
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
		user_id: string,
	) => {
		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(user_id, org_id);

		const results = await Promise.all(
			envs.map(env => limit(async () => {
				const result = await kms.vaultWrite(
					{
						orgId: org_id,
						scopeId: app_id,
						entryType: "secret",
						key: env.key,
						envTypeId: env_type_id,
						value: Buffer.from(env.value, "utf-8"),
						createdBy: user_id,
					},
					sessionToken,
				);
				return { key: env.key, vault_version: result.version };
			})),
		);

		return results;
	};

	public static batchDeleteSecrets = async (
		org_id: string,
		app_id: string,
		env_type_id: string,
		keys: string[],
		user_id: string,
	) => {
		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(user_id, org_id);

		await Promise.all(
			keys.map(key => limit(() =>
				kms.vaultDestroy(org_id, app_id, "secret", key, env_type_id, 0, sessionToken),
			)),
		);
	};

	public static getAppSecretSummary = async ({
		app_id,
		org_id,
		user_id,
	}: {
		app_id: string;
		org_id: string;
		user_id: string;
	}) => {
		const db = await DB.getInstance();
		const envTypes = await db
			.selectFrom("env_type")
			.select("id")
			.where("app_id", "=", app_id)
			.where("org_id", "=", org_id)
			.execute();

		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(user_id, org_id);

		const summary = await Promise.all(
			envTypes.map(async et => {
				const entries = await kms.vaultList(org_id, app_id, "secret", et.id, sessionToken);
				return { env_type_id: et.id, count: entries.length };
			}),
		);

		return summary;
	};
}

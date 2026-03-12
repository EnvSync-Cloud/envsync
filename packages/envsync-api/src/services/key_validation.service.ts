import * as grpc from "@grpc/grpc-js";

import { KMSClient } from "@/libs/kms/client";
import { getVaultSessionToken } from "@/libs/kms/session-manager";

export class KeyValidationService {
	/**
	 * Check if a key already exists in either env or secret Vault paths.
	 */
	public static async checkKeyExists({
		key,
		app_id,
		env_type_id,
		org_id,
		user_id,
		excludeTable,
	}: {
		key: string;
		app_id: string;
		env_type_id: string;
		org_id: string;
		user_id: string;
		excludeTable?: "env_store" | "secret_store";
	}) {
		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(user_id, org_id);

		// Check env path unless excluded
		if (excludeTable !== "env_store") {
			try {
				await kms.vaultRead(
					{ orgId: org_id, scopeId: app_id, entryType: "env", key, envTypeId: env_type_id },
					sessionToken,
				);
				return {
					exists: true,
					type: "environment_variable" as const,
					message: `Key "${key}" already exists as an environment variable`,
				};
			} catch (err) {
				if (!(err instanceof Error && "code" in err && (err as grpc.ServiceError).code === grpc.status.NOT_FOUND)) {
					throw err;
				}
			}
		}

		// Check secret path unless excluded
		if (excludeTable !== "secret_store") {
			try {
				await kms.vaultRead(
					{ orgId: org_id, scopeId: app_id, entryType: "secret", key, envTypeId: env_type_id },
					sessionToken,
				);
				return {
					exists: true,
					type: "secret" as const,
					message: `Key "${key}" already exists as a secret`,
				};
			} catch (err) {
				if (!(err instanceof Error && "code" in err && (err as grpc.ServiceError).code === grpc.status.NOT_FOUND)) {
					throw err;
				}
			}
		}

		return {
			exists: false,
			type: null,
			message: null,
		};
	}

	/**
	 * Validate multiple keys at once using optimized LIST calls.
	 * Instead of N individual reads, uses 2 LIST calls to get all existing keys,
	 * then checks membership in a Set.
	 */
	public static async validateKeys({
		keys,
		app_id,
		env_type_id,
		org_id,
		user_id,
		excludeTable,
	}: {
		keys: string[];
		app_id: string;
		env_type_id: string;
		org_id: string;
		user_id: string;
		excludeTable?: "env_store" | "secret_store";
	}) {
		const kms = await KMSClient.getInstance();
		const sessionToken = await getVaultSessionToken(user_id, org_id);
		const conflicts: { key: string; type: string | null; message: string | null }[] = [];

		// Fetch existing keys via LIST (much more efficient than N individual reads)
		const [envEntries, secretEntries] = await Promise.all([
			excludeTable === "env_store"
				? Promise.resolve([])
				: kms.vaultList(org_id, app_id, "env", env_type_id, sessionToken),
			excludeTable === "secret_store"
				? Promise.resolve([])
				: kms.vaultList(org_id, app_id, "secret", env_type_id, sessionToken),
		]);

		const envKeySet = new Set(envEntries.map(e => e.key));
		const secretKeySet = new Set(secretEntries.map(e => e.key));

		for (const key of keys) {
			if (excludeTable !== "env_store" && envKeySet.has(key)) {
				conflicts.push({
					key,
					type: "environment_variable",
					message: `Key "${key}" already exists as an environment variable`,
				});
			} else if (excludeTable !== "secret_store" && secretKeySet.has(key)) {
				conflicts.push({
					key,
					type: "secret",
					message: `Key "${key}" already exists as a secret`,
				});
			}
		}

		return conflicts;
	}

	/**
	 * Filter out conflicting keys from a batch, returning only safe-to-write keys.
	 * Use this for idempotent batch operations where partial success is acceptable.
	 */
	public static async filterConflicts({
		keys,
		app_id,
		env_type_id,
		org_id,
		user_id,
		excludeTable,
	}: {
		keys: string[];
		app_id: string;
		env_type_id: string;
		org_id: string;
		user_id: string;
		excludeTable?: "env_store" | "secret_store";
	}): Promise<{ safeKeys: string[]; conflicts: { key: string; type: string | null; message: string | null }[] }> {
		const conflicts = await this.validateKeys({ keys, app_id, env_type_id, org_id, user_id, excludeTable });
		const conflictKeySet = new Set(conflicts.map(c => c.key));
		const safeKeys = keys.filter(k => !conflictKeySet.has(k));
		return { safeKeys, conflicts };
	}
}

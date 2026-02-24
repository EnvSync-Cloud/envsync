import { VaultClient } from "@/libs/vault";
import { envPath, envScopePath, secretPath, secretScopePath } from "@/libs/vault/paths";

export class KeyValidationService {
	/**
	 * Check if a key already exists in either env or secret Vault paths.
	 */
	public static async checkKeyExists({
		key,
		app_id,
		env_type_id,
		org_id,
		excludeTable,
	}: {
		key: string;
		app_id: string;
		env_type_id: string;
		org_id: string;
		excludeTable?: "env_store" | "secret_store";
	}) {
		const vault = await VaultClient.getInstance();

		// Check env path unless excluded
		if (excludeTable !== "env_store") {
			const path = envPath(org_id, app_id, env_type_id, key);
			const result = await vault.kvRead(path);

			if (result) {
				return {
					exists: true,
					type: "environment_variable" as const,
					message: `Key "${key}" already exists as an environment variable`,
				};
			}
		}

		// Check secret path unless excluded
		if (excludeTable !== "secret_store") {
			const path = secretPath(org_id, app_id, env_type_id, key);
			const result = await vault.kvRead(path);

			if (result) {
				return {
					exists: true,
					type: "secret" as const,
					message: `Key "${key}" already exists as a secret`,
				};
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
		excludeTable,
	}: {
		keys: string[];
		app_id: string;
		env_type_id: string;
		org_id: string;
		excludeTable?: "env_store" | "secret_store";
	}) {
		const vault = await VaultClient.getInstance();
		const conflicts: { key: string; type: string | null; message: string | null }[] = [];

		// Fetch existing keys via LIST (much more efficient than N individual reads)
		const [envKeys, secretKeys] = await Promise.all([
			excludeTable === "env_store"
				? Promise.resolve([])
				: vault.kvList(envScopePath(org_id, app_id, env_type_id)),
			excludeTable === "secret_store"
				? Promise.resolve([])
				: vault.kvList(secretScopePath(org_id, app_id, env_type_id)),
		]);

		const envKeySet = new Set(envKeys);
		const secretKeySet = new Set(secretKeys);

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
		excludeTable,
	}: {
		keys: string[];
		app_id: string;
		env_type_id: string;
		org_id: string;
		excludeTable?: "env_store" | "secret_store";
	}): Promise<{ safeKeys: string[]; conflicts: { key: string; type: string | null; message: string | null }[] }> {
		const conflicts = await this.validateKeys({ keys, app_id, env_type_id, org_id, excludeTable });
		const conflictKeySet = new Set(conflicts.map(c => c.key));
		const safeKeys = keys.filter(k => !conflictKeySet.has(k));
		return { safeKeys, conflicts };
	}
}

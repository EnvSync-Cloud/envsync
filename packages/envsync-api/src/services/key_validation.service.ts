import { STDBClient } from "@/libs/stdb";

export class KeyValidationService {
	/**
	 * Check if a key already exists in either env or secret STDB tables.
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
		const stdb = STDBClient.getInstance();
		const resultJson = await stdb.callReducer<string>(
			"check_key_exists",
			[org_id, app_id, env_type_id, key, excludeTable || ""],
			{ injectRootKey: false },
		);
		return JSON.parse(resultJson) as {
			exists: boolean;
			type: "environment_variable" | "secret" | null;
			message: string | null;
		};
	}

	/**
	 * Validate multiple keys at once using a single STDB call.
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
		const stdb = STDBClient.getInstance();
		const resultJson = await stdb.callReducer<string>(
			"list_keys_in_scope",
			[org_id, app_id, env_type_id],
			{ injectRootKey: false },
		);
		const result = JSON.parse(resultJson) as {
			env_keys: string[];
			secret_keys: string[];
		};

		const envKeySet = new Set(excludeTable === "env_store" ? [] : result.env_keys);
		const secretKeySet = new Set(excludeTable === "secret_store" ? [] : result.secret_keys);
		const conflicts: { key: string; type: string | null; message: string | null }[] = [];

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

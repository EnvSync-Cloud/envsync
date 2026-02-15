import { DB } from "@/libs/db";

export class KeyValidationService {
	/**
	 * Check if a key already exists in either env_store or secret_store
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
		const db = await DB.getInstance();

		// Check env_store unless excluded
		if (excludeTable !== "env_store") {
			const envExists = await db
				.selectFrom("env_store")
				.select("key")
				.where("key", "=", key)
				.where("app_id", "=", app_id)
				.where("env_type_id", "=", env_type_id)
				.where("org_id", "=", org_id)
				.executeTakeFirst();

			if (envExists) {
				return {
					exists: true,
					type: "environment_variable" as const,
					message: `Key "${key}" already exists as an environment variable`,
				};
			}
		}

		// Check secret_store unless excluded
		if (excludeTable !== "secret_store") {
			const secretExists = await db
				.selectFrom("secret_store")
				.select("key")
				.where("key", "=", key)
				.where("app_id", "=", app_id)
				.where("env_type_id", "=", env_type_id)
				.where("org_id", "=", org_id)
				.executeTakeFirst();

			if (secretExists) {
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
	 * Validate multiple keys at once
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
		const conflicts = [];

		for (const key of keys) {
			const result = await this.checkKeyExists({
				key,
				app_id,
				env_type_id,
				org_id,
				excludeTable,
			});

			if (result.exists) {
				conflicts.push({
					key,
					type: result.type,
					message: result.message,
				});
			}
		}

		return conflicts;
	}
}

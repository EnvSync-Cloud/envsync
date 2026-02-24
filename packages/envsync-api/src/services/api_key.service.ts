import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { DB } from "@/libs/db";
import { orNotFound } from "@/libs/errors";
import { SecretKeyGenerator } from "sk-keygen";

export class ApiKeyService {
	public static createKey = async ({
		user_id,
		org_id,
		description,
	}: {
		user_id: string;
		org_id: string;
		description?: string;
	}) => {
		const db = await DB.getInstance();

		const key = await db
			.insertInto("api_keys")
			.values({
				id: uuidv4(),
				user_id,
				org_id,
				description: description || "",
				is_active: true,
				key: SecretKeyGenerator.generateKey({
					prefix: "eVs",
				}),
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		await invalidateCache(
			CacheKeys.apiKeysByOrg(org_id),
			CacheKeys.apiKeysByUser(user_id),
		);

		return key;
	};

	public static getKey = async (id: string) => {
		const db = await DB.getInstance();

		const key = await orNotFound(
			db
				.selectFrom("api_keys")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"API Key",
			id,
		);

		return key;
	};

	public static getAllKeys = async (orgId: string, page = 1, per_page = 50) => {
		const db = await DB.getInstance();

		const keys = await db
			.selectFrom("api_keys")
			.selectAll()
			.where("org_id", "=", orgId)
			.limit(per_page)
			.offset((page - 1) * per_page)
			.execute();

		return keys;
	};

	public static updateKey = async (
		id: string,
		data: {
			description?: string;
			is_active?: boolean;
			last_used_at?: Date;
		},
	) => {
		const db = await DB.getInstance();

		// Fetch key before update for invalidation
		const existing = await orNotFound(
			db
				.selectFrom("api_keys")
				.select(["key", "org_id", "user_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"API Key",
			id,
		);

		await db
			.updateTable("api_keys")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();

		await invalidateCache(
			CacheKeys.apiKeyByCreds(existing.key),
			CacheKeys.apiKeysByOrg(existing.org_id),
			CacheKeys.apiKeysByUser(existing.user_id),
		);
	};

	public static deleteKey = async (id: string) => {
		const db = await DB.getInstance();

		// Fetch key before delete for invalidation
		const existing = await orNotFound(
			db
				.selectFrom("api_keys")
				.select(["key", "org_id", "user_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"API Key",
			id,
		);

		await db.deleteFrom("api_keys").where("id", "=", id).executeTakeFirstOrThrow();

		await invalidateCache(
			CacheKeys.apiKeyByCreds(existing.key),
			CacheKeys.apiKeysByOrg(existing.org_id),
			CacheKeys.apiKeysByUser(existing.user_id),
		);
	};

	public static regenerateKey = async (id: string) => {
		const db = await DB.getInstance();

		// Fetch old key for invalidation
		const existing = await orNotFound(
			db
				.selectFrom("api_keys")
				.select(["key", "org_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"API Key",
			id,
		);

		const newKey = SecretKeyGenerator.generateKey({
			prefix: "eVs",
		});

		await db
			.updateTable("api_keys")
			.set({
				key: newKey,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();

		await invalidateCache(
			CacheKeys.apiKeyByCreds(existing.key),
			CacheKeys.apiKeysByOrg(existing.org_id),
		);

		return { newKey, id };
	};

	public static getKeyByUserId = async (userId: string) => {
		return cacheAside(CacheKeys.apiKeysByUser(userId), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const keys = await db
				.selectFrom("api_keys")
				.selectAll()
				.where("user_id", "=", userId)
				.execute();

			return keys;
		});
	};

	public static getKeyByCreds = async (api_key: string) => {
		return cacheAside(CacheKeys.apiKeyByCreds(api_key), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const key = await orNotFound(
				db
					.selectFrom("api_keys")
					.where("key", "=", api_key)
					.selectAll()
					.executeTakeFirstOrThrow(),
				"API Key",
			);

			return key;
		});
	};

	public static registerKeyUsage = async (id: string) => {
		const db = await DB.getInstance();

		await db
			.updateTable("api_keys")
			.set({
				last_used_at: new Date(),
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();
	};
}

import { v4 as uuidv4 } from "uuid";

import { DB } from "@/libs/db";
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

		return key;
	};

	public static getKey = async (id: string) => {
		const db = await DB.getInstance();

		const key = await db
			.selectFrom("api_keys")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		return key;
	};

	public static getAllKeys = async (orgId: string) => {
		const db = await DB.getInstance();

		const keys = await db.selectFrom("api_keys").selectAll().where("org_id", "=", orgId).execute();

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

		await db
			.updateTable("api_keys")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();
	};

	public static deleteKey = async (id: string) => {
		const db = await DB.getInstance();

		await db.deleteFrom("api_keys").where("id", "=", id).executeTakeFirstOrThrow();
	};

	public static regenerateKey = async (id: string) => {
		const db = await DB.getInstance();

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

		return { newKey, id };
	};

	public static getKeyByUserId = async (userId: string) => {
		const db = await DB.getInstance();

		const keys = await db
			.selectFrom("api_keys")
			.selectAll()
			.where("user_id", "=", userId)
			.execute();

		return keys;
	};

	public static getKeyByCreds = async (api_key: string) => {
		const db = await DB.getInstance();

		const key = await db
			.selectFrom("api_keys")
			.where("key", "=", api_key)
			.selectAll()
			.executeTakeFirstOrThrow();

		return key;
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

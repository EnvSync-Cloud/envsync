import { createHash, randomUUID } from "node:crypto";

import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { DB } from "@/libs/db";
import { orNotFound } from "@/libs/errors";

const TOKEN_PREFIX = "esv_";

function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export class ServiceTokenService {
	public static generateToken(): string {
		return `${TOKEN_PREFIX}${randomUUID()}`;
	}

	public static createToken = async ({
		org_id,
		created_by_user_id,
		name,
		app_id,
		env_type_id,
		permissions,
		expires_in_days,
	}: {
		org_id: string;
		created_by_user_id: string;
		name: string;
		app_id?: string;
		env_type_id?: string;
		permissions?: { read: boolean; write: boolean };
		expires_in_days: number;
	}) => {
		const db = await DB.getInstance();
		const token = this.generateToken();
		const token_hash = hashToken(token);
		const expires_at = new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000);

		const record = await db
			.insertInto("service_tokens")
			.values({
				id: uuidv4(),
				org_id,
				created_by_user_id,
				name,
				token_hash,
				app_id: app_id ?? null,
				env_type_id: env_type_id ?? null,
				permissions: permissions ?? { read: true, write: false },
				expires_at,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		await invalidateCache(CacheKeys.serviceTokensByOrg(org_id));

		return { ...record, token };
	};

	public static getToken = async (id: string) => {
		const db = await DB.getInstance();

		return orNotFound(
			db
				.selectFrom("service_tokens")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"Service Token",
			id,
		);
	};

	public static getAllTokens = async (orgId: string, page = 1, per_page = 50) => {
		return cacheAside(CacheKeys.serviceTokensByOrg(orgId), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			return db
				.selectFrom("service_tokens")
				.selectAll()
				.where("org_id", "=", orgId)
				.orderBy("created_at", "desc")
				.limit(per_page)
				.offset((page - 1) * per_page)
				.execute();
		});
	};

	public static deleteToken = async (id: string) => {
		const db = await DB.getInstance();

		const existing = await orNotFound(
			db
				.selectFrom("service_tokens")
				.select(["token_hash", "org_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"Service Token",
			id,
		);

		await db.deleteFrom("service_tokens").where("id", "=", id).executeTakeFirstOrThrow();

		await invalidateCache(
			CacheKeys.serviceTokenByHash(existing.token_hash),
			CacheKeys.serviceTokensByOrg(existing.org_id),
		);
	};

	public static validateTokenByHash = async (token: string) => {
		const token_hash = hashToken(token);

		return cacheAside(CacheKeys.serviceTokenByHash(token_hash), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const record = await db
				.selectFrom("service_tokens")
				.selectAll()
				.where("token_hash", "=", token_hash)
				.executeTakeFirst();

			if (!record) return null;

			if (new Date(record.expires_at) < new Date()) return null;

			return record;
		});
	};

	public static registerUsage = async (id: string) => {
		const db = await DB.getInstance();

		await db
			.updateTable("service_tokens")
			.set({ last_used_at: new Date(), updated_at: new Date() })
			.where("id", "=", id)
			.execute();
	};

	public static isScopedToApp = (token: { app_id: string | null }, appId: string): boolean => {
		return token.app_id === null || token.app_id === appId;
	};

	public static isScopedToEnvType = (token: { env_type_id: string | null }, envTypeId: string): boolean => {
		return token.env_type_id === null || token.env_type_id === envTypeId;
	};

	public static hasPermission = (
		token: { permissions: Record<string, boolean> },
		permission: "read" | "write",
	): boolean => {
		return token.permissions[permission] === true;
	};
}

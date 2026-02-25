import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { STDBClient } from "@/libs/stdb";
import { NotFoundError } from "@/libs/errors";
import { SecretKeyGenerator } from "sk-keygen";

interface ApiKeyRow {
	uuid: string;
	user_id: string;
	org_id: string;
	description: string;
	is_active: boolean;
	key: string;
	last_used_at: string | null;
	created_at: string;
	updated_at: string;
}

function mapRow(row: ApiKeyRow) {
	return {
		id: row.uuid,
		user_id: row.user_id,
		org_id: row.org_id,
		description: row.description,
		is_active: row.is_active,
		key: row.key,
		last_used_at: row.last_used_at ? new Date(row.last_used_at) : null,
		created_at: new Date(row.created_at),
		updated_at: new Date(row.updated_at),
	};
}

export class ApiKeyService {
	private static stdb() {
		return STDBClient.getInstance();
	}

	public static createKey = async ({
		user_id,
		org_id,
		description,
	}: {
		user_id: string;
		org_id: string;
		description?: string;
	}) => {
		const stdb = this.stdb();
		const id = crypto.randomUUID();
		const now = new Date().toISOString();
		const key = SecretKeyGenerator.generateKey({
			prefix: "eVs",
		});

		await stdb.callReducer("create_api_key", [
			id,
			user_id,
			org_id,
			description || "",
			true,
			key,
			now,
			now,
		]);

		await invalidateCache(
			CacheKeys.apiKeysByOrg(org_id),
			CacheKeys.apiKeysByUser(user_id),
		);

		return mapRow({
			uuid: id,
			user_id,
			org_id,
			description: description || "",
			is_active: true,
			key,
			last_used_at: null,
			created_at: now,
			updated_at: now,
		});
	};

	public static getKey = async (id: string) => {
		const stdb = this.stdb();

		const row = await stdb.queryOne<ApiKeyRow>(
			`SELECT * FROM api_key WHERE uuid = '${id}'`,
		);

		if (!row) {
			throw new NotFoundError("API Key", id);
		}

		return mapRow(row);
	};

	public static getAllKeys = async (orgId: string, page = 1, per_page = 50) => {
		const stdb = this.stdb();

		const rows = await stdb.queryPaginated<ApiKeyRow>(
			`SELECT * FROM api_key WHERE org_id = '${orgId}'`,
			per_page,
			(page - 1) * per_page,
		);

		return rows.map(mapRow);
	};

	public static updateKey = async (
		id: string,
		data: {
			description?: string;
			is_active?: boolean;
			last_used_at?: Date;
		},
	) => {
		const stdb = this.stdb();

		// Fetch key before update for invalidation
		const existing = await stdb.queryOne<ApiKeyRow>(
			`SELECT * FROM api_key WHERE uuid = '${id}'`,
		);

		if (!existing) {
			throw new NotFoundError("API Key", id);
		}

		const now = new Date().toISOString();

		await stdb.callReducer("update_api_key", [
			id,
			JSON.stringify({
				...data,
				last_used_at: data.last_used_at ? data.last_used_at.toISOString() : undefined,
			}),
			now,
		]);

		await invalidateCache(
			CacheKeys.apiKeyByCreds(existing.key),
			CacheKeys.apiKeysByOrg(existing.org_id),
			CacheKeys.apiKeysByUser(existing.user_id),
		);
	};

	public static deleteKey = async (id: string) => {
		const stdb = this.stdb();

		// Fetch key before delete for invalidation
		const existing = await stdb.queryOne<ApiKeyRow>(
			`SELECT * FROM api_key WHERE uuid = '${id}'`,
		);

		if (!existing) {
			throw new NotFoundError("API Key", id);
		}

		await stdb.callReducer("delete_api_key", [id]);

		await invalidateCache(
			CacheKeys.apiKeyByCreds(existing.key),
			CacheKeys.apiKeysByOrg(existing.org_id),
			CacheKeys.apiKeysByUser(existing.user_id),
		);
	};

	public static regenerateKey = async (id: string) => {
		const stdb = this.stdb();

		// Fetch old key for invalidation
		const existing = await stdb.queryOne<ApiKeyRow>(
			`SELECT * FROM api_key WHERE uuid = '${id}'`,
		);

		if (!existing) {
			throw new NotFoundError("API Key", id);
		}

		const newKey = SecretKeyGenerator.generateKey({
			prefix: "eVs",
		});
		const now = new Date().toISOString();

		await stdb.callReducer("update_api_key", [
			id,
			JSON.stringify({ key: newKey }),
			now,
		]);

		await invalidateCache(
			CacheKeys.apiKeyByCreds(existing.key),
			CacheKeys.apiKeysByOrg(existing.org_id),
		);

		return { newKey, id };
	};

	public static getKeyByUserId = async (userId: string) => {
		return cacheAside(CacheKeys.apiKeysByUser(userId), CacheTTL.SHORT, async () => {
			const stdb = ApiKeyService.stdb();

			const rows = await stdb.query<ApiKeyRow>(
				`SELECT * FROM api_key WHERE user_id = '${userId}'`,
			);

			return rows.map(mapRow);
		});
	};

	public static getKeyByCreds = async (api_key: string) => {
		return cacheAside(CacheKeys.apiKeyByCreds(api_key), CacheTTL.SHORT, async () => {
			const stdb = ApiKeyService.stdb();

			const row = await stdb.queryOne<ApiKeyRow>(
				`SELECT * FROM api_key WHERE key = '${api_key}'`,
			);

			if (!row) {
				throw new NotFoundError("API Key");
			}

			return mapRow(row);
		});
	};

	public static registerKeyUsage = async (id: string) => {
		const stdb = this.stdb();
		const now = new Date().toISOString();

		await stdb.callReducer("update_api_key", [
			id,
			JSON.stringify({ last_used_at: now }),
			now,
		]);
	};
}

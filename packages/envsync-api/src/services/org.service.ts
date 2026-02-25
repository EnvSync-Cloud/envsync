import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { STDBClient } from "@/libs/stdb";

export class OrgService {
	public static createOrg = async (data: {
		name: string;
		slug: string;
		logo_url?: string;
		size?: string;
		website?: string;
	}) => {
		const stdb = STDBClient.getInstance();
		const uuid = crypto.randomUUID();

		await stdb.callReducer(
			"create_org",
			[
				uuid,
				data.name,
				data.slug,
				data.logo_url || "",
				data.size || "",
				data.website || "",
				JSON.stringify({}),
			],
			{ injectRootKey: false },
		);

		return uuid;
	};

	public static getOrg = async (id: string) => {
		return cacheAside(CacheKeys.org(id), CacheTTL.LONG, async () => {
			const stdb = STDBClient.getInstance();

			const row = await stdb.queryOne<{
				uuid: string;
				name: string;
				slug: string;
				logo_url: string;
				size: string;
				website: string;
				metadata: string;
				created_at: number;
				updated_at: number;
			}>(`SELECT * FROM org WHERE uuid = '${id}'`);

			if (!row) {
				throw new Error("no result");
			}

			return {
				id: row.uuid,
				name: row.name,
				slug: row.slug,
				logo_url: row.logo_url,
				size: row.size,
				website: row.website,
				metadata: row.metadata ? JSON.parse(row.metadata) : {},
				created_at: new Date(Number(row.created_at) / 1000),
				updated_at: new Date(Number(row.updated_at) / 1000),
			};
		});
	};

	public static updateOrg = async (
		id: string,
		data: {
			logo_url?: string;
			website?: string;
			name?: string;
			slug?: string;
		},
	) => {
		const stdb = STDBClient.getInstance();

		// Fetch current org to merge with partial update
		const current = await stdb.queryOne<{
			uuid: string;
			name: string;
			logo_url: string;
			size: string;
			website: string;
			metadata: string;
		}>(`SELECT * FROM org WHERE uuid = '${id}'`);

		if (!current) {
			throw new Error("no result");
		}

		await stdb.callReducer(
			"update_org",
			[
				id,
				data.name ?? current.name,
				data.logo_url ?? current.logo_url,
				current.size,
				data.website ?? current.website,
				current.metadata,
			],
			{ injectRootKey: false },
		);

		await invalidateCache(CacheKeys.org(id));
	};

	public static checkIfSlugExists = async (slug: string) => {
		const stdb = STDBClient.getInstance();

		const row = await stdb.queryOne<{ uuid: string }>(
			`SELECT * FROM org WHERE slug = '${slug}'`,
		);

		return !!row;
	};
}

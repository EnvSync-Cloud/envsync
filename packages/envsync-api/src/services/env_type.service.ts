import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { DB } from "@/libs/db";
import { AuthorizationService } from "@/services/authorization.service";

export class EnvTypeService {
	public static createEnvType = async ({
		name,
		org_id,
		app_id,
		color,
		is_default,
		is_protected,
	}: {
		name: string;
		org_id: string;
		app_id: string;
		color: string;
		is_default: boolean;
		is_protected: boolean;
	}) => {
		const db = await DB.getInstance();

		const { id } = await db
			.insertInto("env_type")
			.values({
				id: uuidv4(),
				name,
				org_id,
				app_id,
				color,
				is_default,
				is_protected,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returning("id")
			.executeTakeFirstOrThrow();

		// Write structural FGA tuples: env_type belongs to app and org
		await AuthorizationService.writeEnvTypeRelations(id, app_id, org_id);

		await invalidateCache(CacheKeys.envTypesByOrg(org_id));

		return { id, name };
	};

	public static getEnvTypes = async (org_id: string) => {
		return cacheAside(CacheKeys.envTypesByOrg(org_id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const env_types = await db
				.selectFrom("env_type")
				.selectAll()
				.where("org_id", "=", org_id)
				.execute();

			return env_types;
		});
	};

	public static getEnvType = async (id: string) => {
		return cacheAside(CacheKeys.envType(id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const env_type = await db
				.selectFrom("env_type")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirstOrThrow();

			return env_type;
		});
	};

	public static updateEnvType = async (
		id: string,
		data: {
			name?: string;
			color?: string;
			is_default?: boolean;
			is_protected?: boolean;
		},
	) => {
		const db = await DB.getInstance();

		// Fetch env_type to get org_id for invalidation
		const envType = await db
			.selectFrom("env_type")
			.select("org_id")
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		await db
			.updateTable("env_type")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();

		await invalidateCache(CacheKeys.envType(id), CacheKeys.envTypesByOrg(envType.org_id));
	};

	public static deleteEnvType = async (id: string) => {
		const db = await DB.getInstance();

		// Fetch env_type to get org_id for invalidation
		const envType = await db
			.selectFrom("env_type")
			.select("org_id")
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		await db.deleteFrom("env_type").where("id", "=", id).execute();

		// Clean up FGA tuples for this env_type
		await AuthorizationService.deleteResourceTuples("env_type", id);

		await invalidateCache(CacheKeys.envType(id), CacheKeys.envTypesByOrg(envType.org_id));
	};
}

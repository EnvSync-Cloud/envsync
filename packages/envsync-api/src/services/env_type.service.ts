import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { DB } from "@/libs/db";
import { orNotFound, ValidationError } from "@/libs/errors";
import { runSaga } from "@/helpers/saga";
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
		const appExists = await db
			.selectFrom("app")
			.select("id")
			.where("id", "=", app_id)
			.executeTakeFirst();
		if (!appExists) {
			throw new ValidationError(`App not found: ${app_id}`);
		}

		const ctx: {
			envType?: {
				id: string; name: string; org_id: string; app_id: string;
				color: string; is_default: boolean; is_protected: boolean;
				created_at: Date; updated_at: Date;
			};
		} = {};
		await runSaga("createEnvType", ctx, [
			{
				name: "db-insert",
				execute: async (c) => {
					const db = await DB.getInstance();
					const result = await db
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
						.returning(["id", "name", "org_id", "app_id", "color", "is_default", "is_protected", "created_at", "updated_at"])
						.executeTakeFirstOrThrow();
					c.envType = result;
				},
				compensate: async (c) => {
					const db = await DB.getInstance();
					await db.deleteFrom("env_type").where("id", "=", c.envType?.id ?? "").execute();
				},
			},
			{
				name: "fga-write",
				execute: async (c) => {
					await AuthorizationService.writeEnvTypeRelations(c.envType!.id, app_id, org_id);
				},
				compensate: async (c) => {
					await AuthorizationService.deleteResourceTuples("env_type", c.envType!.id);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.envTypesByOrg(org_id));
				},
			},
		]);

		return ctx.envType!;
	};

	public static getEnvTypes = async (org_id: string) => {
		return cacheAside(CacheKeys.envTypesByOrg(org_id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const env_types = await db
				.selectFrom("env_type")
				.select([
					"id",
					"name",
					"org_id",
					"app_id",
					"is_default",
					"is_protected",
					"color",
					"created_at",
					"updated_at",
				])
				.where("org_id", "=", org_id)
				.execute();

			return env_types;
		});
	};

	public static getEnvType = async (id: string) => {
		return cacheAside(CacheKeys.envType(id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const env_type = await orNotFound(
				db
					.selectFrom("env_type")
					.selectAll()
					.where("id", "=", id)
					.executeTakeFirstOrThrow(),
				"EnvType",
				id,
			);

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
		const envType = await orNotFound(
			db
				.selectFrom("env_type")
				.select("org_id")
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"EnvType",
			id,
		);

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

		const envType = await orNotFound(
			db
				.selectFrom("env_type")
				.select("org_id")
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"EnvType",
			id,
		);

		await runSaga("deleteEnvType", {}, [
			{
				name: "db-delete",
				execute: async () => {
					await db.deleteFrom("env_type").where("id", "=", id).execute();
				},
			},
			{
				name: "fga-cleanup",
				execute: async () => {
					await AuthorizationService.deleteResourceTuples("env_type", id);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.envType(id), CacheKeys.envTypesByOrg(envType.org_id));
				},
			},
		]);
	};
}

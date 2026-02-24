import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { DB } from "@/libs/db";
import { orNotFound, NotFoundError } from "@/libs/errors";
import infoLogs, { LogTypes } from "@/libs/logger";
import { appsCreated } from "@/libs/telemetry/metrics";
import { VaultClient } from "@/libs/vault";
import { envScopePath, secretScopePath } from "@/libs/vault/paths";
import { runSaga } from "@/helpers/saga";
import { AuthorizationService } from "@/services/authorization.service";

export class AppService {
	public static createApp = async ({
		name,
		org_id,
		description,
		metadata,
		enable_secrets,
		is_managed_secret = false,
		public_key = null,
		private_key = null,
	}: {
		name: string;
		org_id: string;
		description: string;
		metadata: Record<string, any>;
		enable_secrets: boolean;
		is_managed_secret?: boolean;
		public_key?: string | null;
		private_key?: string | null;
	}) => {
		const ctx: { app?: { id: string; name: string; description: string; org_id: string; enable_secrets: boolean; is_managed_secret: boolean; public_key: string | null | undefined; metadata: Record<string, unknown>; created_at: Date; updated_at: Date } } = {};
		await runSaga("createApp", ctx, [
			{
				name: "db-insert",
				execute: async (c) => {
					const db = await DB.getInstance();
					c.app = await db
						.insertInto("app")
						.values({
							id: uuidv4(),
							name,
							org_id,
							description,
							metadata,
							created_at: new Date(),
							updated_at: new Date(),
							enable_secrets,
							is_managed_secret,
							public_key,
							private_key,
						})
						.returning([
							"id",
							"name",
							"description",
							"org_id",
							"enable_secrets",
							"is_managed_secret",
							"public_key",
							"metadata",
							"created_at",
							"updated_at",
						])
						.executeTakeFirstOrThrow();
				},
				compensate: async (c) => {
					if (c.app) {
						const db = await DB.getInstance();
						await db.deleteFrom("app").where("id", "=", c.app.id).execute();
					}
				},
			},
			{
				name: "fga-write",
				execute: async (c) => {
					await AuthorizationService.writeAppOrgRelation(c.app!.id, org_id);
				},
				compensate: async (c) => {
					if (c.app) {
						await AuthorizationService.deleteResourceTuples("app", c.app.id);
					}
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.appsByOrg(org_id));
				},
			},
		]);

		appsCreated.add(1);
		return ctx.app!;
	};

	public static getApp = async ({ id }: { id: string }) => {
		return cacheAside(CacheKeys.app(id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const app = await orNotFound(
				db
					.selectFrom("app")
					.select([
						"id",
						"name",
						"description",
						"org_id",
						"enable_secrets",
						"is_managed_secret",
						"public_key",
						"metadata",
						"created_at",
						"updated_at",
					])
					.where("id", "=", id)
					.executeTakeFirstOrThrow(),
				"App",
				id,
			);

			return app;
		});
	};

	public static updateApp = async (
		id: string,
		data: {
			name?: string;
			description?: string;
			metadata?: Record<string, any>;
		},
	) => {
		const db = await DB.getInstance();

		// Fetch app to get org_id for invalidation
		const app = await orNotFound(
			db
				.selectFrom("app")
				.select("org_id")
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"App",
			id,
		);

		await db
			.updateTable("app")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();

		await invalidateCache(CacheKeys.app(id), CacheKeys.appsByOrg(app.org_id));
	};

	public static deleteApp = async ({ id }: { id: string }) => {
		const db = await DB.getInstance();

		const app = await orNotFound(
			db
				.selectFrom("app")
				.select("org_id")
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"App",
			id,
		);

		await runSaga("deleteApp", {}, [
			{
				name: "db-delete",
				execute: async () => {
					const db = await DB.getInstance();
					await db.deleteFrom("app").where("id", "=", id).executeTakeFirstOrThrow();
				},
			},
			{
				name: "fga-cleanup",
				execute: async () => {
					await AuthorizationService.deleteResourceTuples("app", id);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.app(id), CacheKeys.appsByOrg(app.org_id));
				},
			},
		]);
	};

	public static getAllApps = async (org_id: string) => {
		return cacheAside(CacheKeys.appsByOrg(org_id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const apps = await db
				.selectFrom("app")
				.select([
					"id",
					"name",
					"description",
					"org_id",
					"enable_secrets",
					"is_managed_secret",
					"public_key",
					"metadata",
					"created_at",
					"updated_at",
				])
				.where("org_id", "=", org_id)
				.execute();

			return apps;
		});
	};

	public static getAppEnvTypes = async ({ app_id }: { app_id: string }) => {
		const db = await DB.getInstance();

		const envTypes = await db
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
			.where("app_id", "=", app_id)
			.execute();

		return envTypes;
	};

	public static getEnvCountByApp = async ({
		app_id,
		org_id,
	}: {
		app_id: string;
		org_id: string;
	}) => {
		const db = await DB.getInstance();
		const envTypes = await db
			.selectFrom("env_type")
			.select("id")
			.where("app_id", "=", app_id)
			.where("org_id", "=", org_id)
			.execute();

		if (envTypes.length === 0) return 0;

		try {
			const vault = await VaultClient.getInstance();
			const counts = await Promise.all(
				envTypes.map(async et => {
					const keys = await vault.kvList(envScopePath(org_id, app_id, et.id));
					return keys.length;
				}),
			);
			return counts.reduce((sum, c) => sum + c, 0);
		} catch (err) {
			infoLogs(
				`Failed to fetch env count for app ${app_id}: ${err instanceof Error ? err.message : err}`,
				LogTypes.ERROR,
				"AppService",
			);
			return 0;
		}
	};

	public static getSecretCountByApp = async ({
		app_id,
		org_id,
	}: {
		app_id: string;
		org_id: string;
	}) => {
		const db = await DB.getInstance();
		const envTypes = await db
			.selectFrom("env_type")
			.select("id")
			.where("app_id", "=", app_id)
			.where("org_id", "=", org_id)
			.execute();

		if (envTypes.length === 0) return 0;

		try {
			const vault = await VaultClient.getInstance();
			const counts = await Promise.all(
				envTypes.map(async et => {
					const keys = await vault.kvList(secretScopePath(org_id, app_id, et.id));
					return keys.length;
				}),
			);
			return counts.reduce((sum, c) => sum + c, 0);
		} catch (err) {
			infoLogs(
				`Failed to fetch secret count for app ${app_id}: ${err instanceof Error ? err.message : err}`,
				LogTypes.ERROR,
				"AppService",
			);
			return 0;
		}
	};

	public static getManagedAppPrivateKey = async (app_id: string) => {
		const db = await DB.getInstance();

		const secret = await db
			.selectFrom("app")
			.select("private_key")
			.where("is_managed_secret", "=", true)
			.where("id", "=", app_id)
			.executeTakeFirst();

		if (!secret) {
			throw new NotFoundError("Managed app private key", app_id);
		}

		return secret.private_key;
	};
}

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { NotFoundError } from "@/libs/errors";
import infoLogs, { LogTypes } from "@/libs/logger";
import { appsCreated } from "@/libs/telemetry/metrics";
import { STDBClient } from "@/libs/stdb";
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
		const id = crypto.randomUUID();
		const now = new Date();
		const ctx: { app?: { id: string; name: string; description: string; org_id: string; enable_secrets: boolean; is_managed_secret: boolean; public_key: string | null | undefined; metadata: Record<string, unknown>; created_at: Date; updated_at: Date } } = {};

		await runSaga("createApp", ctx, [
			{
				name: "stdb-insert",
				execute: async (c) => {
					const stdb = STDBClient.getInstance();
					await stdb.callReducer("create_app_with_auth", [
						id,
						name,
						org_id,
						description,
						JSON.stringify(metadata),
						enable_secrets,
						is_managed_secret,
						public_key,
						private_key,
					]);
					c.app = {
						id,
						name,
						description,
						org_id,
						enable_secrets,
						is_managed_secret,
						public_key,
						metadata,
						created_at: now,
						updated_at: now,
					};
				},
				compensate: async (c) => {
					if (c.app) {
						const stdb = STDBClient.getInstance();
						await stdb.callReducer("delete_app", [c.app.id]);
					}
				},
			},
			{
				name: "auth-write",
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
			const stdb = STDBClient.getInstance();
			const row = await stdb.queryOne<{
				uuid: string;
				name: string;
				description: string;
				org_id: string;
				enable_secrets: boolean;
				is_managed_secret: boolean;
				public_key: string | null;
				metadata: string;
				created_at: string;
				updated_at: string;
			}>(`SELECT * FROM app WHERE uuid = '${id}'`);

			if (!row) throw new NotFoundError("App", id);

			return {
				id: row.uuid,
				name: row.name,
				description: row.description,
				org_id: row.org_id,
				enable_secrets: row.enable_secrets,
				is_managed_secret: row.is_managed_secret,
				public_key: row.public_key,
				metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
				created_at: new Date(row.created_at),
				updated_at: new Date(row.updated_at),
			};
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
		const stdb = STDBClient.getInstance();

		const row = await stdb.queryOne<{ org_id: string }>(`SELECT org_id FROM app WHERE uuid = '${id}'`);
		if (!row) throw new NotFoundError("App", id);

		await stdb.callReducer("update_app", [
			id,
			data.name ?? null,
			data.description ?? null,
			data.metadata ? JSON.stringify(data.metadata) : null,
		]);

		await invalidateCache(CacheKeys.app(id), CacheKeys.appsByOrg(row.org_id));
	};

	public static deleteApp = async ({ id }: { id: string }) => {
		const stdb = STDBClient.getInstance();

		const row = await stdb.queryOne<{ org_id: string }>(`SELECT org_id FROM app WHERE uuid = '${id}'`);
		if (!row) throw new NotFoundError("App", id);

		await runSaga("deleteApp", {}, [
			{
				name: "stdb-delete",
				execute: async () => {
					await stdb.callReducer("delete_app", [id]);
				},
			},
			{
				name: "auth-cleanup",
				execute: async () => {
					await AuthorizationService.deleteResourceTuples("app", id);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.app(id), CacheKeys.appsByOrg(row.org_id));
				},
			},
		]);
	};

	public static getAllApps = async (org_id: string) => {
		return cacheAside(CacheKeys.appsByOrg(org_id), CacheTTL.SHORT, async () => {
			const stdb = STDBClient.getInstance();

			const rows = await stdb.query<{
				uuid: string;
				name: string;
				description: string;
				org_id: string;
				enable_secrets: boolean;
				is_managed_secret: boolean;
				public_key: string | null;
				metadata: string;
				created_at: string;
				updated_at: string;
			}>(`SELECT * FROM app WHERE org_id = '${org_id}'`);

			return rows.map((row) => ({
				id: row.uuid,
				name: row.name,
				description: row.description,
				org_id: row.org_id,
				enable_secrets: row.enable_secrets,
				is_managed_secret: row.is_managed_secret,
				public_key: row.public_key,
				metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
				created_at: new Date(row.created_at),
				updated_at: new Date(row.updated_at),
			}));
		});
	};

	public static getAppEnvTypes = async ({ app_id }: { app_id: string }) => {
		const stdb = STDBClient.getInstance();

		const rows = await stdb.query<{
			uuid: string;
			name: string;
			org_id: string;
			app_id: string;
			is_default: boolean;
			is_protected: boolean;
			color: string | null;
			created_at: string;
			updated_at: string;
		}>(`SELECT * FROM env_type WHERE app_id = '${app_id}'`);

		return rows.map((row) => ({
			id: row.uuid,
			name: row.name,
			org_id: row.org_id,
			app_id: row.app_id,
			is_default: row.is_default,
			is_protected: row.is_protected,
			color: row.color,
			created_at: new Date(row.created_at),
			updated_at: new Date(row.updated_at),
		}));
	};

	public static getEnvCountByApp = async ({
		app_id,
		org_id,
	}: {
		app_id: string;
		org_id: string;
	}) => {
		const stdb = STDBClient.getInstance();
		const envTypes = await stdb.query<{ uuid: string }>(
			`SELECT uuid FROM env_type WHERE app_id = '${app_id}' AND org_id = '${org_id}'`,
		);

		if (envTypes.length === 0) return 0;

		try {
			const counts = await Promise.all(
				envTypes.map(async (et) => {
					const resultJson = await stdb.callReducer<string>(
						"list_keys_in_scope",
						[org_id, app_id, et.uuid],
						{ injectRootKey: false },
					);
					const result = JSON.parse(resultJson);
					return result.env_keys.length;
				}),
			);
			return counts.reduce((sum: number, c: number) => sum + c, 0);
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
		const stdb = STDBClient.getInstance();
		const envTypes = await stdb.query<{ uuid: string }>(
			`SELECT uuid FROM env_type WHERE app_id = '${app_id}' AND org_id = '${org_id}'`,
		);

		if (envTypes.length === 0) return 0;

		try {
			const counts = await Promise.all(
				envTypes.map(async (et) => {
					const resultJson = await stdb.callReducer<string>(
						"list_keys_in_scope",
						[org_id, app_id, et.uuid],
						{ injectRootKey: false },
					);
					const result = JSON.parse(resultJson);
					return result.secret_keys.length;
				}),
			);
			return counts.reduce((sum: number, c: number) => sum + c, 0);
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
		const stdb = STDBClient.getInstance();

		const row = await stdb.queryOne<{ private_key: string | null }>(
			`SELECT private_key FROM app WHERE uuid = '${app_id}' AND is_managed_secret = true`,
		);

		if (!row) {
			throw new NotFoundError("Managed app private key", app_id);
		}

		return row.private_key;
	};
}

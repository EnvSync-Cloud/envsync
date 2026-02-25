import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { STDBClient } from "@/libs/stdb";
import { NotFoundError, ValidationError } from "@/libs/errors";
import { AuthorizationService } from "@/services/authorization.service";

interface EnvTypeRow {
	uuid: string;
	name: string;
	org_id: string;
	app_id: string;
	color: string;
	is_default: boolean;
	is_protected: boolean;
	created_at: string;
	updated_at: string;
}

function mapRow(row: EnvTypeRow) {
	return {
		id: row.uuid,
		name: row.name,
		org_id: row.org_id,
		app_id: row.app_id,
		color: row.color,
		is_default: row.is_default,
		is_protected: row.is_protected,
		created_at: new Date(row.created_at),
		updated_at: new Date(row.updated_at),
	};
}

export class EnvTypeService {
	private static stdb() {
		return STDBClient.getInstance();
	}

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
		const stdb = this.stdb();

		// Verify app exists
		const appRow = await stdb.queryOne<{ uuid: string }>(
			`SELECT uuid FROM app WHERE uuid = '${app_id}'`,
		);
		if (!appRow) {
			throw new ValidationError(`App not found: ${app_id}`);
		}

		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		// Atomic STDB reducer: creates env_type row + auth tuples in one call
		await stdb.callReducer("create_env_type_with_auth", [
			id,
			name,
			org_id,
			app_id,
			color,
			is_default,
			is_protected,
			now,
			now,
		]);

		await invalidateCache(CacheKeys.envTypesByOrg(org_id));

		return {
			id,
			name,
			org_id,
			app_id,
			color,
			is_default,
			is_protected,
			created_at: new Date(now),
			updated_at: new Date(now),
		};
	};

	public static getEnvTypes = async (org_id: string) => {
		return cacheAside(CacheKeys.envTypesByOrg(org_id), CacheTTL.SHORT, async () => {
			const stdb = EnvTypeService.stdb();

			const rows = await stdb.query<EnvTypeRow>(
				`SELECT * FROM env_type WHERE org_id = '${org_id}'`,
			);

			return rows.map(mapRow);
		});
	};

	public static getEnvType = async (id: string) => {
		return cacheAside(CacheKeys.envType(id), CacheTTL.SHORT, async () => {
			const stdb = EnvTypeService.stdb();

			const row = await stdb.queryOne<EnvTypeRow>(
				`SELECT * FROM env_type WHERE uuid = '${id}'`,
			);

			if (!row) {
				throw new NotFoundError("EnvType", id);
			}

			return mapRow(row);
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
		const stdb = this.stdb();

		// Fetch env_type to get org_id for invalidation
		const existing = await stdb.queryOne<EnvTypeRow>(
			`SELECT * FROM env_type WHERE uuid = '${id}'`,
		);

		if (!existing) {
			throw new NotFoundError("EnvType", id);
		}

		const now = new Date().toISOString();

		await stdb.callReducer("update_env_type", [
			id,
			JSON.stringify(data),
			now,
		]);

		await invalidateCache(CacheKeys.envType(id), CacheKeys.envTypesByOrg(existing.org_id));
	};

	public static deleteEnvType = async (id: string) => {
		const stdb = this.stdb();

		const existing = await stdb.queryOne<EnvTypeRow>(
			`SELECT * FROM env_type WHERE uuid = '${id}'`,
		);

		if (!existing) {
			throw new NotFoundError("EnvType", id);
		}

		// Delete the env_type row
		await stdb.callReducer("delete_env_type", [id]);

		// Clean up auth tuples
		await AuthorizationService.deleteResourceTuples("env_type", id);

		await invalidateCache(CacheKeys.envType(id), CacheKeys.envTypesByOrg(existing.org_id));
	};
}

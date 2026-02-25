import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { createKeycloakUser } from "@/helpers/keycloak";
import { STDBClient } from "@/libs/stdb";
import { NotFoundError } from "@/libs/errors";
import { runSaga } from "@/helpers/saga";
import { AuthorizationService } from "@/services/authorization.service";

export class UserService {
	public static createUser = async (data: {
		email: string;
		full_name: string;
		password: string;
		org_id: string;
		role_id: string;
	}) => {
		const ctx = { userId: "", authServiceId: "" };
		await runSaga("createUser", ctx, [
			{
				name: "idp-create",
				execute: async (c) => {
					const parts = data.full_name.trim().split(/\s+/).filter(Boolean);
					const firstName = parts[0]?.slice(0, 200) ?? "User";
					const lastName = parts.slice(1).join(" ").slice(0, 200) || "-";

					const kcUser = await createKeycloakUser({
						email: data.email,
						firstName,
						lastName,
						password: data.password,
					});
					c.authServiceId = kcUser.id;
				},
			},
			{
				name: "stdb-insert",
				execute: async (c) => {
					const stdb = STDBClient.getInstance();
					const id = crypto.randomUUID();
					await stdb.callReducer("create_user", [
						id,
						data.email,
						data.full_name,
						data.org_id,
						data.role_id,
						c.authServiceId,
					]);
					c.userId = id;
				},
				compensate: async (c) => {
					if (c.userId) {
						const stdb = STDBClient.getInstance();
						await stdb.callReducer("delete_user", [c.userId]);
					}
				},
			},
			{
				name: "auth-assign-role",
				execute: async (c) => {
					await AuthorizationService.assignRoleToUser(c.userId, data.org_id, data.role_id);
				},
				compensate: async (c) => {
					await AuthorizationService.removeUserOrgPermissions(c.userId, data.org_id);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.usersByOrg(data.org_id));
				},
			},
		]);

		return { id: ctx.userId };
	};

	public static getUser = async (id: string) => {
		return cacheAside(CacheKeys.user(id), CacheTTL.SHORT, async () => {
			const stdb = STDBClient.getInstance();
			const row = await stdb.queryOne<{
				uuid: string;
				email: string;
				full_name: string;
				org_id: string;
				role_id: string;
				auth_service_id: string | null;
				is_active: boolean;
				profile_picture_url: string | null;
				created_at: string;
				updated_at: string;
			}>(`SELECT * FROM user WHERE uuid = '${id}'`);

			if (!row) throw new NotFoundError("User", id);

			return {
				id: row.uuid,
				email: row.email,
				full_name: row.full_name,
				org_id: row.org_id,
				role_id: row.role_id,
				auth_service_id: row.auth_service_id,
				is_active: row.is_active,
				profile_picture_url: row.profile_picture_url,
				created_at: new Date(row.created_at),
				updated_at: new Date(row.updated_at),
			};
		});
	};

	public static getAllUser = async (org_id: string, page = 1, per_page = 50) => {
		const stdb = STDBClient.getInstance();
		const offset = (page - 1) * per_page;

		const rows = await stdb.query<{
			uuid: string;
			email: string;
			full_name: string;
			org_id: string;
			role_id: string;
			auth_service_id: string | null;
			is_active: boolean;
			profile_picture_url: string | null;
			created_at: string;
			updated_at: string;
		}>(`SELECT * FROM user WHERE org_id = '${org_id}' LIMIT ${per_page} OFFSET ${offset}`);

		return rows.map((row) => ({
			id: row.uuid,
			email: row.email,
			full_name: row.full_name,
			org_id: row.org_id,
			role_id: row.role_id,
			auth_service_id: row.auth_service_id,
			is_active: row.is_active,
			profile_picture_url: row.profile_picture_url,
			created_at: new Date(row.created_at),
			updated_at: new Date(row.updated_at),
		}));
	};

	public static updateUser = async (
		id: string,
		data: {
			full_name?: string;
			profile_picture_url?: string;
			role_id?: string;
			email?: string;
		},
	) => {
		const stdb = STDBClient.getInstance();

		// Fetch user before update for invalidation keys
		const row = await stdb.queryOne<{
			org_id: string;
			auth_service_id: string | null;
		}>(`SELECT org_id, auth_service_id FROM user WHERE uuid = '${id}'`);

		if (!row) throw new NotFoundError("User", id);

		// If role_id is changing, re-sync auth tuples
		if (data.role_id) {
			await AuthorizationService.resyncUserRole(id, row.org_id, data.role_id);
		}

		await stdb.callReducer("update_user", [
			id,
			data.full_name ?? null,
			data.profile_picture_url ?? null,
			data.role_id ?? null,
			data.email ?? null,
		]);

		const keysToInvalidate = [CacheKeys.user(id), CacheKeys.usersByOrg(row.org_id)];
		if (row.auth_service_id) keysToInvalidate.push(CacheKeys.userByIdp(row.auth_service_id));
		await invalidateCache(...keysToInvalidate);
	};

	public static deleteUser = async (id: string) => {
		const stdb = STDBClient.getInstance();

		const row = await stdb.queryOne<{
			org_id: string;
			auth_service_id: string | null;
		}>(`SELECT org_id, auth_service_id FROM user WHERE uuid = '${id}'`);

		if (!row) throw new NotFoundError("User", id);

		await runSaga("deleteUser", {}, [
			{
				name: "stdb-delete",
				execute: async () => {
					await stdb.callReducer("delete_user", [id]);
				},
			},
			{
				name: "auth-cleanup",
				execute: async () => {
					await AuthorizationService.removeUserOrgPermissions(id, row.org_id);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					const keysToInvalidate = [CacheKeys.user(id), CacheKeys.usersByOrg(row.org_id), CacheKeys.allForUser(id)];
					if (row.auth_service_id) keysToInvalidate.push(CacheKeys.userByIdp(row.auth_service_id));
					await invalidateCache(...keysToInvalidate);
				},
			},
		]);
	};

	public static getUserByKeycloakId = async (auth_service_id: string) => {
		return cacheAside(CacheKeys.userByIdp(auth_service_id), CacheTTL.SHORT, async () => {
			const stdb = STDBClient.getInstance();
			const row = await stdb.queryOne<{
				uuid: string;
				email: string;
				full_name: string;
				org_id: string;
				role_id: string;
				auth_service_id: string | null;
				is_active: boolean;
				profile_picture_url: string | null;
				created_at: string;
				updated_at: string;
			}>(`SELECT * FROM user WHERE auth_service_id = '${auth_service_id}'`);

			if (!row) throw new NotFoundError("User");

			return {
				id: row.uuid,
				email: row.email,
				full_name: row.full_name,
				org_id: row.org_id,
				role_id: row.role_id,
				auth_service_id: row.auth_service_id,
				is_active: row.is_active,
				profile_picture_url: row.profile_picture_url,
				created_at: new Date(row.created_at),
				updated_at: new Date(row.updated_at),
			};
		});
	};

	public static getUserByIdpId = (idpId: string) => UserService.getUserByKeycloakId(idpId);
}

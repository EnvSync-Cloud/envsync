import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { createZitadelUser } from "@/helpers/zitadel";
import { DB } from "@/libs/db";
import { AuthorizationService } from "@/services/authorization.service";

export class UserService {
	public static createUser = async (data: {
		email: string;
		full_name: string;
		password: string;
		org_id: string;
		role_id: string;
	}) => {
		const db = await DB.getInstance();

		const parts = data.full_name.trim().split(/\s+/).filter(Boolean);
		const firstName = parts[0]?.slice(0, 200) ?? "User";
		const lastName = parts.slice(1).join(" ").slice(0, 200) || "-";

		const zUser = await createZitadelUser({
			userName: data.email,
			email: data.email,
			firstName,
			lastName,
			password: data.password,
		});

		const { id } = await db
			.insertInto("users")
			.values({
				id: uuidv4(),
				is_active: true,
				email: data.email,
				org_id: data.org_id,
				role_id: data.role_id,
				auth_service_id: zUser.id,
				full_name: data.full_name,
				profile_picture_url: null,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returning("id")
			.executeTakeFirstOrThrow();

		// Write FGA tuples based on the user's role
		await AuthorizationService.assignRoleToUser(id, data.org_id, data.role_id);

		await invalidateCache(CacheKeys.usersByOrg(data.org_id));

		return { id };
	};

	public static getUser = async (id: string) => {
		return cacheAside(CacheKeys.user(id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirstOrThrow();

			return user;
		});
	};

	public static getAllUser = async (org_id: string) => {
		return cacheAside(CacheKeys.usersByOrg(org_id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("org_id", "=", org_id)
				.execute();

			return user;
		});
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
		const db = await DB.getInstance();

		// Fetch user before update for invalidation keys
		const user = await db
			.selectFrom("users")
			.select(["org_id", "auth_service_id"])
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		// If role_id is changing, re-sync FGA tuples
		if (data.role_id) {
			await AuthorizationService.resyncUserRole(id, user.org_id, data.role_id);
		}

		await db
			.updateTable("users")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();

		const keysToInvalidate = [CacheKeys.user(id), CacheKeys.usersByOrg(user.org_id)];
		if (user.auth_service_id) keysToInvalidate.push(CacheKeys.userByIdp(user.auth_service_id));
		await invalidateCache(...keysToInvalidate);
	};

	public static deleteUser = async (id: string) => {
		const db = await DB.getInstance();

		// Get user's org before deletion for FGA cleanup and cache invalidation
		const user = await db
			.selectFrom("users")
			.select(["org_id", "auth_service_id"])
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		await db.deleteFrom("users").where("id", "=", id).executeTakeFirstOrThrow();

		// Remove all FGA tuples for this user on their org
		await AuthorizationService.removeUserOrgPermissions(id, user.org_id);

		const keysToInvalidate = [CacheKeys.user(id), CacheKeys.usersByOrg(user.org_id), CacheKeys.allForUser(id)];
		if (user.auth_service_id) keysToInvalidate.push(CacheKeys.userByIdp(user.auth_service_id));
		await invalidateCache(...keysToInvalidate);
	};

	public static getUserByKeycloakId = async (auth_service_id: string) => {
		return cacheAside(CacheKeys.userByIdp(auth_service_id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();
			const user = await db
				.selectFrom("users")
				.selectAll()
				.where("auth_service_id", "=", auth_service_id)
				.executeTakeFirstOrThrow();
			return user;
		});
	};

	public static getUserByIdpId = (idpId: string) => UserService.getUserByKeycloakId(idpId);
}

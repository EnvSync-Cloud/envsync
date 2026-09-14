import { type Selectable } from "kysely";
import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { createKeycloakUser } from "@/helpers/keycloak";
import { DB } from "@/libs/db";
import { AppError, orNotFound } from "@/libs/errors";
import { runSaga } from "@/helpers/saga";
import { invalidateSessionToken } from "@/libs/kms/session-manager";
import { AuthorizationService } from "@/services/authorization.service";
import type { Database } from "@/types/db";

type UserMembershipRecord = Selectable<Database["users"]>;

export interface MembershipSummary {
	user_id: string;
	org_id: string;
	org_name: string;
	org_slug: string;
	role_id: string;
	role_name: string;
	is_admin: boolean;
	is_master: boolean;
	is_active: boolean;
}

export class UserService {
	private static membershipDateValue(value: Date | string | null | undefined) {
		if (!value) return 0;
		if (value instanceof Date) return value.getTime();
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
	}

	private static compareMembershipPriority(a: UserMembershipRecord, b: UserMembershipRecord) {
		return (
			UserService.membershipDateValue(b.last_login) - UserService.membershipDateValue(a.last_login) ||
			UserService.membershipDateValue(b.updated_at) - UserService.membershipDateValue(a.updated_at) ||
			UserService.membershipDateValue(b.created_at) - UserService.membershipDateValue(a.created_at)
		);
	}

	private static sortMemberships<T extends UserMembershipRecord>(memberships: T[]) {
		return [...memberships].sort(UserService.compareMembershipPriority);
	}

	private static fetchUsersByIdpId = async (auth_service_id: string) => {
		const db = await DB.getInstance();
		if (process.env.E2E_DEBUG_AUTH === "1") {
			const direct = await db
				.selectFrom("users")
				.select(["id", "auth_service_id", "org_id", "role_id"])
				.where("auth_service_id", "=", auth_service_id)
				.executeTakeFirst();
			console.log(
				`[AUTH DEBUG] lookup db=${process.env.DATABASE_NAME} auth_service_id=${auth_service_id} found=${direct ? "yes" : "no"} user_id=${direct?.id ?? ""}`,
			);
		}

		return db
			.selectFrom("users")
			.selectAll()
			.where("auth_service_id", "=", auth_service_id)
			.execute();
	};

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

					const zUser = await createKeycloakUser({
						userName: data.email,
						email: data.email,
						firstName,
						lastName,
						password: data.password,
					});
					c.authServiceId = zUser.id;
				},
			},
			{
				name: "db-insert",
				execute: async (c) => {
					const db = await DB.getInstance();
					const { id } = await db
						.insertInto("users")
						.values({
							id: uuidv4(),
							is_active: true,
							email: data.email,
							org_id: data.org_id,
							role_id: data.role_id,
							auth_service_id: c.authServiceId,
							full_name: data.full_name,
							profile_picture_url: null,
							created_at: new Date(),
							updated_at: new Date(),
						})
						.returning("id")
						.executeTakeFirstOrThrow();
					c.userId = id;
				},
				compensate: async (c) => {
					const db = await DB.getInstance();
					await db.deleteFrom("users").where("id", "=", c.userId).execute();
				},
			},
			{
				name: "fga-assign-role",
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

	public static createMembershipForExistingIdentity = async (data: {
		email: string;
		full_name: string;
		profile_picture_url?: string | null;
		auth_service_id: string;
		org_id: string;
		role_id: string;
		is_active?: boolean;
	}) => {
		const ctx = { userId: "" };
		await runSaga("createMembershipForExistingIdentity", ctx, [
			{
				name: "db-insert",
				execute: async (c) => {
					const db = await DB.getInstance();
					const { id } = await db
						.insertInto("users")
						.values({
							id: uuidv4(),
							is_active: data.is_active ?? true,
							email: data.email,
							org_id: data.org_id,
							role_id: data.role_id,
							auth_service_id: data.auth_service_id,
							full_name: data.full_name,
							profile_picture_url: data.profile_picture_url ?? null,
							last_login: new Date(),
							created_at: new Date(),
							updated_at: new Date(),
						})
						.returning("id")
						.executeTakeFirstOrThrow();
					c.userId = id;
				},
				compensate: async (c) => {
					const db = await DB.getInstance();
					await db.deleteFrom("users").where("id", "=", c.userId).execute();
				},
			},
			{
				name: "fga-assign-role",
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
					await invalidateCache(
						CacheKeys.usersByOrg(data.org_id),
						CacheKeys.userByIdp(data.auth_service_id),
					);
				},
			},
		]);

		return { id: ctx.userId };
	};

	public static getUser = async (id: string) => {
		return cacheAside(CacheKeys.user(id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const user = await orNotFound(
				db
					.selectFrom("users")
					.selectAll()
					.where("id", "=", id)
					.executeTakeFirstOrThrow(),
				"User",
				id,
			);

			return user;
		});
	};

	public static getAllUser = async (org_id: string, page = 1, per_page = 50) => {
		const db = await DB.getInstance();

		const user = await db
			.selectFrom("users")
			.selectAll()
			.where("org_id", "=", org_id)
			.limit(per_page)
			.offset((page - 1) * per_page)
			.execute();

		return user;
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
		const user = await orNotFound(
			db
				.selectFrom("users")
				.select(["org_id", "auth_service_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"User",
			id,
		);

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
		invalidateSessionToken(id, user.org_id);
	};

	public static deleteUser = async (id: string) => {
		const db = await DB.getInstance();

		const user = await orNotFound(
			db
				.selectFrom("users")
				.select(["org_id", "auth_service_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"User",
			id,
		);

		await runSaga("deleteUser", {}, [
			{
				name: "db-delete",
				execute: async () => {
					await db.deleteFrom("users").where("id", "=", id).executeTakeFirstOrThrow();
				},
			},
			{
				name: "fga-cleanup",
				execute: async () => {
					await AuthorizationService.removeUserOrgPermissions(id, user.org_id);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					const keysToInvalidate = [CacheKeys.user(id), CacheKeys.usersByOrg(user.org_id), CacheKeys.allForUser(id)];
					if (user.auth_service_id) keysToInvalidate.push(CacheKeys.userByIdp(user.auth_service_id));
					await invalidateCache(...keysToInvalidate);
					invalidateSessionToken(id, user.org_id);
				},
			},
		]);
	};

	public static hasOtherMembershipsForAuthService = async (auth_service_id: string, excluding_user_id: string) => {
		const db = await DB.getInstance();
		const membership = await db
			.selectFrom("users")
			.select("id")
			.where("auth_service_id", "=", auth_service_id)
			.where("id", "!=", excluding_user_id)
			.executeTakeFirst();

		return Boolean(membership);
	};

	public static getOrphanedAuthServiceIdsForOrg = async (org_id: string) => {
		const db = await DB.getInstance();
		const orgUsers = await db
			.selectFrom("users")
			.select(["id", "auth_service_id"])
			.where("org_id", "=", org_id)
			.where("auth_service_id", "is not", null)
			.execute();

		const orphanedIds = new Set<string>();
		for (const user of orgUsers) {
			if (!user.auth_service_id) continue;
			const hasOtherMemberships = await this.hasOtherMembershipsForAuthService(user.auth_service_id, user.id);
			if (!hasOtherMemberships) {
				orphanedIds.add(user.auth_service_id);
			}
		}

		return Array.from(orphanedIds);
	};

	public static listUsersByIdpId = async (auth_service_id: string) => {
		const users = await UserService.fetchUsersByIdpId(auth_service_id);
		return UserService.sortMemberships(users);
	};

	public static resolveActiveMembershipByIdpId = async (
		auth_service_id: string,
		requestedMembershipId?: string,
	) => {
		const users = await UserService.listUsersByIdpId(auth_service_id);

		if (users.length === 0) {
			throw new Error(`User not found for auth service id ${auth_service_id}`);
		}

		if (requestedMembershipId) {
			const requestedMembership = users.find(user => user.id === requestedMembershipId);
			if (requestedMembership) {
				return requestedMembership;
			}
		}

		return users[0];
	};

	public static resolveMembershipByOrgId = async (
		auth_service_id: string,
		org_id: string,
	) => {
		const users = await UserService.listUsersByIdpId(auth_service_id);

		if (users.length === 0) {
			throw new Error(`User not found for auth service id ${auth_service_id}`);
		}

		const membership = users.find(user => user.org_id === org_id);
		if (!membership) {
			throw new AppError(
				"Authenticated identity does not belong to the requested organization.",
				403,
				"AUTH_ORG_MEMBERSHIP_REQUIRED",
			);
		}

		return membership;
	};

	public static touchLastLogin = async (id: string) => {
		const db = await DB.getInstance();
		const user = await orNotFound(
			db
				.selectFrom("users")
				.select(["org_id", "auth_service_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"User",
			id,
		);

		await db
			.updateTable("users")
			.set({
				last_login: new Date(),
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		const keysToInvalidate = [CacheKeys.user(id), CacheKeys.usersByOrg(user.org_id)];
		if (user.auth_service_id) keysToInvalidate.push(CacheKeys.userByIdp(user.auth_service_id));
		await invalidateCache(...keysToInvalidate);
	};

	public static switchActiveMembership = async (auth_service_id: string, org_id: string) => {
		const memberships = await UserService.listUsersByIdpId(auth_service_id);
		const membership = memberships.find(user => user.org_id === org_id);

		if (!membership) {
			throw new Error(`No membership found for org ${org_id}`);
		}

		await UserService.touchLastLogin(membership.id);
		return UserService.getUser(membership.id);
	};

	public static listMembershipSummariesByIdpId = async (
		auth_service_id: string,
		activeMembershipUserId: string,
	): Promise<MembershipSummary[]> => {
		const db = await DB.getInstance();
		const rows = await db
			.selectFrom("users")
			.innerJoin("orgs", "orgs.id", "users.org_id")
			.innerJoin("org_role", "org_role.id", "users.role_id")
			.select([
				"users.id as user_id",
				"users.org_id as org_id",
				"users.role_id as role_id",
				"users.last_login as last_login",
				"users.updated_at as updated_at",
				"users.created_at as created_at",
				"orgs.name as org_name",
				"orgs.slug as org_slug",
				"org_role.name as role_name",
				"org_role.is_admin as is_admin",
				"org_role.is_master as is_master",
			])
			.where("users.auth_service_id", "=", auth_service_id)
			.execute();

		return [...rows]
			.sort((a, b) =>
				UserService.compareMembershipPriority(
					{
						id: a.user_id,
						org_id: a.org_id,
						role_id: a.role_id,
						last_login: a.last_login,
						updated_at: a.updated_at,
						created_at: a.created_at,
					} as UserMembershipRecord,
					{
						id: b.user_id,
						org_id: b.org_id,
						role_id: b.role_id,
						last_login: b.last_login,
						updated_at: b.updated_at,
						created_at: b.created_at,
					} as UserMembershipRecord,
				),
			)
			.map(row => ({
				user_id: row.user_id,
				org_id: row.org_id,
				org_name: row.org_name,
				org_slug: row.org_slug,
				role_id: row.role_id,
				role_name: row.role_name,
				is_admin: Boolean(row.is_admin),
				is_master: Boolean(row.is_master),
				is_active: row.user_id === activeMembershipUserId,
			}));
	};

	public static getUserByKeycloakId = async (auth_service_id: string) => {
		return cacheAside(CacheKeys.userByIdp(auth_service_id), CacheTTL.SHORT, async () => {
			return UserService.resolveActiveMembershipByIdpId(auth_service_id);
		});
	};

	public static getUserByIdpId = (idpId: string) => UserService.getUserByKeycloakId(idpId);

	public static getOrgUserByEmail = async (org_id: string, email: string) => {
		const db = await DB.getInstance();
		return db
			.selectFrom("users")
			.selectAll()
			.where("org_id", "=", org_id)
			.where("email", "=", email)
			.executeTakeFirst();
	};
}

import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { deleteKeycloakUser } from "@/helpers/keycloak";
import { runSaga } from "@/helpers/saga";
import { DB } from "@/libs/db";
import { invalidateSessionToken } from "@/libs/kms/session-manager";
import { AuthorizationService } from "@/services/authorization.service";
import { UserService } from "@/services/user.service";

export class OrgService {
	public static createOrg = async (data: {
		name: string;
		slug: string;
		logo_url?: string | null;
		size?: string;
		website?: string | null;
		metadata?: Record<string, unknown>;
	}) => {
		const db = await DB.getInstance();

		const { id } = await db
			.insertInto("orgs")
			.values({
				id: uuidv4(),
				...data,
				metadata: data.metadata ?? {},
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returning("id")
			.executeTakeFirstOrThrow();

		return id;
	};

	public static getOrg = async (id: string) => {
		return cacheAside(CacheKeys.org(id), CacheTTL.LONG, async () => {
			const db = await DB.getInstance();

			const org = await db
				.selectFrom("orgs")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirstOrThrow();

			return org;
		});
	};

	public static updateOrg = async (
		id: string,
		data: {
			logo_url?: string | null;
			website?: string | null;
			name?: string;
			slug?: string;
			metadata?: Record<string, unknown>;
		},
	) => {
		const db = await DB.getInstance();

		await db
			.updateTable("orgs")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		await invalidateCache(CacheKeys.org(id));
	};

	public static checkIfSlugExists = async (slug: string) => {
		const db = await DB.getInstance();

		const org = await db.selectFrom("orgs").selectAll().where("slug", "=", slug).executeTakeFirst();

		return !!org;
	};

	public static getOrgBySlug = async (slug: string) => {
		const db = await DB.getInstance();
		return db.selectFrom("orgs").selectAll().where("slug", "=", slug).executeTakeFirst();
	};

	public static deleteOrg = async (id: string) => {
		const db = await DB.getInstance();
		const [users, teams, apps, envTypes, certs, gpgKeys, orphanedAuthServiceIds] = await Promise.all([
			db.selectFrom("users").select(["id", "auth_service_id"]).where("org_id", "=", id).execute(),
			db.selectFrom("teams").select("id").where("org_id", "=", id).execute(),
			db.selectFrom("app").select("id").where("org_id", "=", id).execute(),
			db.selectFrom("env_type").select("id").where("org_id", "=", id).execute(),
			db.selectFrom("org_certificates").select("id").where("org_id", "=", id).execute(),
			db.selectFrom("gpg_keys").select("id").where("org_id", "=", id).execute(),
			UserService.getOrphanedAuthServiceIdsForOrg(id),
		]);

		await runSaga("deleteOrg", {}, [
			{
				name: "fga-cleanup",
				execute: async () => {
					await Promise.all([
						...users.map((user) => AuthorizationService.removeUserOrgPermissions(user.id, id)),
						...teams.map((team) => AuthorizationService.removeTeamOrgPermissions(team.id, id)),
						...teams.map((team) => AuthorizationService.deleteResourceTuples("team", team.id)),
						...apps.map((app) => AuthorizationService.deleteResourceTuples("app", app.id)),
						...envTypes.map((envType) => AuthorizationService.deleteResourceTuples("env_type", envType.id)),
						...certs.map((cert) => AuthorizationService.deleteResourceTuples("certificate", cert.id)),
						...gpgKeys.map((gpgKey) => AuthorizationService.deleteResourceTuples("gpg_key", gpgKey.id)),
					]);
				},
			},
			{
				name: "db-delete",
				execute: async () => {
					await db.deleteFrom("orgs").where("id", "=", id).executeTakeFirstOrThrow();
				},
			},
			{
				name: "cache-and-session-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.org(id), CacheKeys.allForOrg(id));
					for (const user of users) {
						await invalidateCache(CacheKeys.user(user.id), CacheKeys.allForUser(user.id));
						invalidateSessionToken(user.id, id);
					}
				},
			},
		]);

		await Promise.allSettled(
			orphanedAuthServiceIds.map((authServiceId) => deleteKeycloakUser(authServiceId)),
		);
	};
}

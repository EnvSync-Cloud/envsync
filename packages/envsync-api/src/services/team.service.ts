import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { DB } from "@/libs/db";
import { orNotFound } from "@/libs/errors";
import { runSaga } from "@/helpers/saga";
import { AuthorizationService } from "@/services/authorization.service";

export class TeamService {
	public static createTeam = async ({
		name,
		org_id,
		description,
		color,
	}: {
		name: string;
		org_id: string;
		description?: string;
		color?: string;
	}) => {
		let teamId: string | undefined;
		let teamRow: Record<string, unknown> | undefined;
		await runSaga("createTeam", {}, [
			{
				name: "db-insert",
				execute: async () => {
					const db = await DB.getInstance();
					const result = await db
						.insertInto("teams")
						.values({
							id: uuidv4(),
							name,
							org_id,
							description: description || null,
							color: color || "#000000",
							created_at: new Date(),
							updated_at: new Date(),
						})
						.returningAll()
						.executeTakeFirstOrThrow();
					teamRow = result;
					teamId = result.id;
				},
				compensate: async () => {
					if (teamId) {
						const db = await DB.getInstance();
						await db.deleteFrom("teams").where("id", "=", teamId).execute();
					}
				},
			},
			{
				name: "fga-write",
				execute: async () => {
					await AuthorizationService.writeTeamOrgRelation(teamId!, org_id);
				},
				compensate: async () => {
					if (teamId) {
						await AuthorizationService.deleteResourceTuples("team", teamId);
					}
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.teamsByOrg(org_id));
				},
			},
		]);

		return teamRow!;
	};

	public static getTeam = async (id: string) => {
		return cacheAside(CacheKeys.team(id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const team = await orNotFound(
				db
					.selectFrom("teams")
					.selectAll()
					.where("id", "=", id)
					.executeTakeFirstOrThrow(),
				"Team",
				id,
			);

			return team;
		});
	};

	public static getTeamsByOrg = async (org_id: string, page = 1, per_page = 50) => {
		const db = await DB.getInstance();

		const teams = await db
			.selectFrom("teams")
			.selectAll()
			.where("org_id", "=", org_id)
			.limit(per_page)
			.offset((page - 1) * per_page)
			.execute();

		return teams;
	};

	public static updateTeam = async (
		id: string,
		data: {
			name?: string;
			description?: string;
			color?: string;
		},
	) => {
		const db = await DB.getInstance();

		// Fetch team to get org_id for invalidation
		const team = await orNotFound(
			db
				.selectFrom("teams")
				.select("org_id")
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"Team",
			id,
		);

		await db
			.updateTable("teams")
			.set({
				...data,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.execute();

		await invalidateCache(CacheKeys.team(id), CacheKeys.teamsByOrg(team.org_id));
	};

	public static deleteTeam = async (id: string) => {
		const db = await DB.getInstance();

		const team = await orNotFound(
			db
				.selectFrom("teams")
				.select("org_id")
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"Team",
			id,
		);

		const members = await db
			.selectFrom("team_members")
			.select("user_id")
			.where("team_id", "=", id)
			.execute();

		await runSaga("deleteTeam", {}, [
			{
				name: "fga-remove-members",
				execute: async () => {
					// Batch remove all member FGA tuples in parallel
					await Promise.all(
						members.map(m => AuthorizationService.removeTeamMember(id, m.user_id)),
					);
				},
			},
			{
				name: "db-delete",
				execute: async () => {
					await db.deleteFrom("teams").where("id", "=", id).executeTakeFirstOrThrow();
				},
			},
			{
				name: "fga-cleanup",
				execute: async () => {
					await AuthorizationService.deleteResourceTuples("team", id);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(
						CacheKeys.team(id),
						CacheKeys.teamsByOrg(team.org_id),
						CacheKeys.teamMembers(id),
					);
				},
			},
		]);
	};

	public static getTeamMembers = async (team_id: string) => {
		return cacheAside(CacheKeys.teamMembers(team_id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const members = await db
				.selectFrom("team_members")
				.innerJoin("users", "users.id", "team_members.user_id")
				.select([
					"team_members.id",
					"team_members.user_id",
					"team_members.created_at",
					"users.full_name",
					"users.email",
					"users.profile_picture_url",
				])
				.where("team_members.team_id", "=", team_id)
				.execute();

			return members;
		});
	};

	public static addTeamMember = async (team_id: string, user_id: string) => {
		let memberRow: Record<string, unknown> | undefined;
		await runSaga("addTeamMember", {}, [
			{
				name: "db-insert",
				execute: async () => {
					const db = await DB.getInstance();
					memberRow = await db
						.insertInto("team_members")
						.values({
							id: uuidv4(),
							team_id,
							user_id,
							created_at: new Date(),
						})
						.returningAll()
						.executeTakeFirstOrThrow();
				},
				compensate: async () => {
					const db = await DB.getInstance();
					await db.deleteFrom("team_members")
						.where("team_id", "=", team_id)
						.where("user_id", "=", user_id)
						.execute();
				},
			},
			{
				name: "fga-write",
				execute: async () => {
					await AuthorizationService.addTeamMember(team_id, user_id);
				},
				compensate: async () => {
					await AuthorizationService.removeTeamMember(team_id, user_id);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.teamMembers(team_id));
				},
			},
		]);

		return memberRow!;
	};

	public static removeTeamMember = async (team_id: string, user_id: string) => {
		await runSaga("removeTeamMember", {}, [
			{
				name: "db-delete",
				execute: async () => {
					const db = await DB.getInstance();
					await db
						.deleteFrom("team_members")
						.where("team_id", "=", team_id)
						.where("user_id", "=", user_id)
						.executeTakeFirstOrThrow();
				},
			},
			{
				name: "fga-remove",
				execute: async () => {
					await AuthorizationService.removeTeamMember(team_id, user_id);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.teamMembers(team_id));
				},
			},
		]);
	};
}

import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { DB } from "@/libs/db";
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
		const db = await DB.getInstance();

		const team = await db
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

		// Write structural FGA tuple: team belongs to org
		await AuthorizationService.writeTeamOrgRelation(team.id, org_id);

		await invalidateCache(CacheKeys.teamsByOrg(org_id));

		return team;
	};

	public static getTeam = async (id: string) => {
		return cacheAside(CacheKeys.team(id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const team = await db
				.selectFrom("teams")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirstOrThrow();

			return team;
		});
	};

	public static getTeamsByOrg = async (org_id: string) => {
		return cacheAside(CacheKeys.teamsByOrg(org_id), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();

			const teams = await db
				.selectFrom("teams")
				.selectAll()
				.where("org_id", "=", org_id)
				.execute();

			return teams;
		});
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
		const team = await db
			.selectFrom("teams")
			.select("org_id")
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

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

		// Fetch team to get org_id for invalidation
		const team = await db
			.selectFrom("teams")
			.select("org_id")
			.where("id", "=", id)
			.executeTakeFirstOrThrow();

		// Get all members to remove their FGA tuples
		const members = await db
			.selectFrom("team_members")
			.select("user_id")
			.where("team_id", "=", id)
			.execute();

		for (const member of members) {
			await AuthorizationService.removeTeamMember(id, member.user_id);
		}

		await db.deleteFrom("teams").where("id", "=", id).executeTakeFirstOrThrow();

		// Clean up remaining FGA tuples for this team
		await AuthorizationService.deleteResourceTuples("team", id);

		await invalidateCache(
			CacheKeys.team(id),
			CacheKeys.teamsByOrg(team.org_id),
			CacheKeys.teamMembers(id),
		);
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
		const db = await DB.getInstance();

		const member = await db
			.insertInto("team_members")
			.values({
				id: uuidv4(),
				team_id,
				user_id,
				created_at: new Date(),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		// Write FGA tuple: user is member of team
		await AuthorizationService.addTeamMember(team_id, user_id);

		await invalidateCache(CacheKeys.teamMembers(team_id));

		return member;
	};

	public static removeTeamMember = async (team_id: string, user_id: string) => {
		const db = await DB.getInstance();

		await db
			.deleteFrom("team_members")
			.where("team_id", "=", team_id)
			.where("user_id", "=", user_id)
			.executeTakeFirstOrThrow();

		// Remove FGA tuple: user is no longer member of team
		await AuthorizationService.removeTeamMember(team_id, user_id);

		await invalidateCache(CacheKeys.teamMembers(team_id));
	};
}

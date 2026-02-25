import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { STDBClient } from "@/libs/stdb";
import { NotFoundError } from "@/libs/errors";
import { AuthorizationService } from "@/services/authorization.service";

interface TeamRow {
	uuid: string;
	name: string;
	org_id: string;
	description: string | null;
	color: string;
	created_at: string;
	updated_at: string;
}

interface TeamMemberRow {
	uuid: string;
	team_id: string;
	user_id: string;
	created_at: string;
}

interface UserRow {
	uuid: string;
	full_name: string;
	email: string;
	profile_picture_url: string | null;
}

function mapTeamRow(row: TeamRow) {
	return {
		id: row.uuid,
		name: row.name,
		org_id: row.org_id,
		description: row.description,
		color: row.color,
		created_at: new Date(row.created_at),
		updated_at: new Date(row.updated_at),
	};
}

export class TeamService {
	private static stdb() {
		return STDBClient.getInstance();
	}

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
		const stdb = this.stdb();
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		await stdb.callReducer("create_team", [
			id,
			name,
			org_id,
			description || null,
			color || "#000000",
			now,
			now,
		]);

		// Write team -> org auth relation
		await AuthorizationService.writeTeamOrgRelation(id, org_id);

		await invalidateCache(CacheKeys.teamsByOrg(org_id));

		return mapTeamRow({
			uuid: id,
			name,
			org_id,
			description: description || null,
			color: color || "#000000",
			created_at: now,
			updated_at: now,
		});
	};

	public static getTeam = async (id: string) => {
		return cacheAside(CacheKeys.team(id), CacheTTL.SHORT, async () => {
			const stdb = TeamService.stdb();

			const row = await stdb.queryOne<TeamRow>(
				`SELECT * FROM team WHERE uuid = '${id}'`,
			);

			if (!row) {
				throw new NotFoundError("Team", id);
			}

			return mapTeamRow(row);
		});
	};

	public static getTeamsByOrg = async (org_id: string, page = 1, per_page = 50) => {
		const stdb = this.stdb();

		const rows = await stdb.queryPaginated<TeamRow>(
			`SELECT * FROM team WHERE org_id = '${org_id}'`,
			per_page,
			(page - 1) * per_page,
		);

		return rows.map(mapTeamRow);
	};

	public static updateTeam = async (
		id: string,
		data: {
			name?: string;
			description?: string;
			color?: string;
		},
	) => {
		const stdb = this.stdb();

		// Fetch team to get org_id for invalidation
		const existing = await stdb.queryOne<TeamRow>(
			`SELECT * FROM team WHERE uuid = '${id}'`,
		);

		if (!existing) {
			throw new NotFoundError("Team", id);
		}

		const now = new Date().toISOString();

		await stdb.callReducer("update_team", [
			id,
			JSON.stringify(data),
			now,
		]);

		await invalidateCache(CacheKeys.team(id), CacheKeys.teamsByOrg(existing.org_id));
	};

	public static deleteTeam = async (id: string) => {
		const stdb = this.stdb();

		const existing = await stdb.queryOne<TeamRow>(
			`SELECT * FROM team WHERE uuid = '${id}'`,
		);

		if (!existing) {
			throw new NotFoundError("Team", id);
		}

		// Get all team members for FGA cleanup
		const memberRows = await stdb.query<TeamMemberRow>(
			`SELECT * FROM team_member WHERE team_id = '${id}'`,
		);

		// Remove all member FGA tuples in parallel
		await Promise.all(
			memberRows.map(m => AuthorizationService.removeTeamMember(id, m.user_id)),
		);

		// Delete the team (will cascade-delete team_members in STDB)
		await stdb.callReducer("delete_team", [id]);

		// Clean up team auth tuples
		await AuthorizationService.deleteResourceTuples("team", id);

		await invalidateCache(
			CacheKeys.team(id),
			CacheKeys.teamsByOrg(existing.org_id),
			CacheKeys.teamMembers(id),
		);
	};

	public static getTeamMembers = async (team_id: string) => {
		return cacheAside(CacheKeys.teamMembers(team_id), CacheTTL.SHORT, async () => {
			const stdb = TeamService.stdb();

			// Step 1: Query team_member rows
			const memberRows = await stdb.query<TeamMemberRow>(
				`SELECT * FROM team_member WHERE team_id = '${team_id}'`,
			);

			if (memberRows.length === 0) {
				return [];
			}

			// Step 2: Query user details for each member
			const userIds = memberRows.map(m => `'${m.user_id}'`).join(", ");
			const userRows = await stdb.query<UserRow>(
				`SELECT uuid, full_name, email, profile_picture_url FROM user WHERE uuid IN (${userIds})`,
			);

			// Build a map for quick lookup
			const userMap = new Map<string, UserRow>();
			for (const u of userRows) {
				userMap.set(u.uuid, u);
			}

			// Step 3: Join the data in application layer
			return memberRows.map(m => {
				const u = userMap.get(m.user_id);
				return {
					id: m.uuid,
					user_id: m.user_id,
					created_at: new Date(m.created_at),
					full_name: u?.full_name ?? null,
					email: u?.email ?? null,
					profile_picture_url: u?.profile_picture_url ?? null,
				};
			});
		});
	};

	public static addTeamMember = async (team_id: string, user_id: string) => {
		const stdb = this.stdb();
		const id = crypto.randomUUID();
		const now = new Date().toISOString();

		await stdb.callReducer("create_team_member", [
			id,
			team_id,
			user_id,
			now,
		]);

		// Write FGA tuple for team membership
		await AuthorizationService.addTeamMember(team_id, user_id);

		await invalidateCache(CacheKeys.teamMembers(team_id));

		return {
			id,
			team_id,
			user_id,
			created_at: new Date(now),
		};
	};

	public static removeTeamMember = async (team_id: string, user_id: string) => {
		const stdb = this.stdb();

		await stdb.callReducer("delete_team_member", [team_id, user_id]);

		// Remove FGA tuple for team membership
		await AuthorizationService.removeTeamMember(team_id, user_id);

		await invalidateCache(CacheKeys.teamMembers(team_id));
	};
}

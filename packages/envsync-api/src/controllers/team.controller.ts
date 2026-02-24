import { type Context } from "hono";

import { TeamService } from "@/services/team.service";
import { AuditLogService } from "@/services/audit_log.service";

export class TeamController {
	public static readonly createTeam = async (c: Context) => {
		const org_id = c.get("org_id");
		const { name, description, color } = await c.req.json();

		if (!name) {
			return c.json({ error: "Name is required." }, 400);
		}

		const team = await TeamService.createTeam({
			name,
			org_id,
			description,
			color,
		});

		await AuditLogService.notifyAuditSystem({
			action: "team_created",
			org_id,
			user_id: c.get("user_id"),
			message: `Team ${name} created.`,
			details: {
				team_id: team.id,
				name,
			},
		});

		return c.json(team, 201);
	};

	public static readonly getTeams = async (c: Context) => {
		const org_id = c.get("org_id");

		const page = Math.max(1, Number(c.req.query("page")) || 1);
		const per_page = Math.min(100, Math.max(1, Number(c.req.query("per_page")) || 50));

		const teams = await TeamService.getTeamsByOrg(org_id, page, per_page);

		await AuditLogService.notifyAuditSystem({
			action: "teams_viewed",
			org_id,
			user_id: c.get("user_id"),
			message: "Teams viewed.",
			details: {
				team_count: teams.length,
			},
		});

		return c.json(teams);
	};

	public static readonly getTeam = async (c: Context) => {
		const org_id = c.get("org_id");
		const id = c.req.param("id");

		const team = await TeamService.getTeam(id);

		if (team.org_id !== org_id) {
			return c.json({ error: "Team does not belong to your organization." }, 403);
		}

		const members = await TeamService.getTeamMembers(id);

		await AuditLogService.notifyAuditSystem({
			action: "team_viewed",
			org_id,
			user_id: c.get("user_id"),
			message: `Team ${team.name} viewed.`,
			details: {
				team_id: team.id,
				name: team.name,
			},
		});

		return c.json({ ...team, members });
	};

	public static readonly updateTeam = async (c: Context) => {
		const org_id = c.get("org_id");
		const id = c.req.param("id");
		const { name, description, color } = await c.req.json();

		const team = await TeamService.getTeam(id);

		if (team.org_id !== org_id) {
			return c.json({ error: "Team does not belong to your organization." }, 403);
		}

		await TeamService.updateTeam(id, { name, description, color });

		await AuditLogService.notifyAuditSystem({
			action: "team_updated",
			org_id,
			user_id: c.get("user_id"),
			message: `Team ${team.name} updated.`,
			details: {
				team_id: team.id,
				name: team.name,
			},
		});

		return c.json({ message: "Team updated successfully." });
	};

	public static readonly deleteTeam = async (c: Context) => {
		const org_id = c.get("org_id");
		const id = c.req.param("id");

		const team = await TeamService.getTeam(id);

		if (team.org_id !== org_id) {
			return c.json({ error: "Team does not belong to your organization." }, 403);
		}

		await TeamService.deleteTeam(id);

		await AuditLogService.notifyAuditSystem({
			action: "team_deleted",
			org_id,
			user_id: c.get("user_id"),
			message: `Team ${team.name} deleted.`,
			details: {
				team_id: team.id,
				name: team.name,
			},
		});

		return c.json({ message: "Team deleted successfully." });
	};

	public static readonly addTeamMember = async (c: Context) => {
		const org_id = c.get("org_id");
		const id = c.req.param("id");
		const { user_id } = await c.req.json();

		if (!user_id) {
			return c.json({ error: "User ID is required." }, 400);
		}

		const team = await TeamService.getTeam(id);

		if (team.org_id !== org_id) {
			return c.json({ error: "Team does not belong to your organization." }, 403);
		}

		const member = await TeamService.addTeamMember(id, user_id);

		await AuditLogService.notifyAuditSystem({
			action: "team_member_added",
			org_id,
			user_id: c.get("user_id"),
			message: `User ${user_id} added to team ${team.name}.`,
			details: {
				team_id: team.id,
				added_user_id: user_id,
			},
		});

		return c.json(member, 201);
	};

	public static readonly removeTeamMember = async (c: Context) => {
		const org_id = c.get("org_id");
		const id = c.req.param("id");
		const user_id = c.req.param("user_id");

		const team = await TeamService.getTeam(id);

		if (team.org_id !== org_id) {
			return c.json({ error: "Team does not belong to your organization." }, 403);
		}

		await TeamService.removeTeamMember(id, user_id);

		await AuditLogService.notifyAuditSystem({
			action: "team_member_removed",
			org_id,
			user_id: c.get("user_id"),
			message: `User ${user_id} removed from team ${team.name}.`,
			details: {
				team_id: team.id,
				removed_user_id: user_id,
			},
		});

		return c.json({ message: "Team member removed successfully." });
	};
}

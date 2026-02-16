import { Kysely } from "kysely";

import { type Database } from "@/types/db";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("teams")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("org_id", "text", col => col.notNull())
		.addColumn("name", "text", col => col.notNull())
		.addColumn("description", "text")
		.addColumn("color", "text", col => col.notNull().defaultTo("#000000"))
		.addColumn("created_at", "timestamp", col => col.notNull().defaultTo("now()"))
		.addColumn("updated_at", "timestamp", col => col.notNull().defaultTo("now()"))
		.addForeignKeyConstraint("fk_teams_org_id_orgs_id", ["org_id"], "orgs", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addUniqueConstraint("uq_teams_org_id_name", ["org_id", "name"])
		.execute();

	await db.schema
		.createTable("team_members")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("team_id", "text", col => col.notNull())
		.addColumn("user_id", "text", col => col.notNull())
		.addColumn("created_at", "timestamp", col => col.notNull().defaultTo("now()"))
		.addForeignKeyConstraint("fk_team_members_team_id_teams_id", ["team_id"], "teams", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint("fk_team_members_user_id_users_id", ["user_id"], "users", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addUniqueConstraint("uq_team_members_team_id_user_id", ["team_id", "user_id"])
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("team_members").execute();
	await db.schema.dropTable("teams").execute();
}

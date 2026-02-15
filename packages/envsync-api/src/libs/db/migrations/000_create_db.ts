import { Kysely } from "kysely";

import { type Database } from "@/types/db";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("orgs")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("name", "text", col => col.notNull())
		.addColumn("logo_url", "text")
		.addColumn("slug", "text", col => col.notNull())
		.addColumn("size", "text")
		.addColumn("website", "text")
		.addColumn("metadata", "jsonb")
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.execute();

	await db.schema.createIndex("orgs_slug_idx").on("orgs").column("slug").execute();

	await db.schema
		.createTable("org_role")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("org_id", "text", col => col.notNull())
		.addColumn("name", "text", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.addForeignKeyConstraint("fk_org_role_org_id_orgs_id", ["org_id"], "orgs", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.execute();

	await db.schema
		.createTable("users")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("email", "text", col => col.notNull())
		.addColumn("org_id", "text", col => col.notNull())
		.addColumn("role_id", "text", col => col.notNull())
		.addColumn("auth0_id", "text")
		.addColumn("full_name", "text")
		.addColumn("profile_picture_url", "text")
		.addColumn("is_active", "boolean", col => col.notNull().defaultTo(false))
		.addColumn("last_login", "timestamptz")
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.addForeignKeyConstraint("fk_users_org_id_orgs_id", ["org_id"], "orgs", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint("fk_users_role_id_org_role_id", ["role_id"], "org_role", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.execute();

	await db.schema
		.createTable("invite_org")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("email", "text", col => col.notNull())
		.addColumn("invite_token", "text", col => col.notNull())
		.addColumn("is_accepted", "boolean", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.execute();

	await db.schema
		.createTable("invite_user")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("email", "text", col => col.notNull())
		.addColumn("org_id", "text", col => col.notNull())
		.addColumn("role_id", "text", col => col.notNull())
		.addColumn("invite_token", "text", col => col.notNull())
		.addColumn("is_accepted", "boolean", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.addForeignKeyConstraint("fk_invite_user_org_id_orgs_id", ["org_id"], "orgs", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint(
			"fk_invite_user_role_id_org_role_id",
			["role_id"],
			"org_role",
			["id"],
			cb => cb.onDelete("cascade"),
		)
		.execute();

	await db.schema
		.createTable("app")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("name", "text", col => col.notNull())
		.addColumn("org_id", "text", col => col.notNull())
		.addColumn("description", "text")
		.addColumn("metadata", "jsonb")
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.addForeignKeyConstraint("fk_app_org_id_orgs_id", ["org_id"], "orgs", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.execute();

	await db.schema
		.createTable("env_type")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("org_id", "text", col => col.notNull())
		.addColumn("name", "text", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.addForeignKeyConstraint("fk_env_type_org_id_orgs_id", ["org_id"], "orgs", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.execute();

	await db.schema
		.createTable("env_store")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("org_id", "text", col => col.notNull())
		.addColumn("env_type_id", "text", col => col.notNull())
		.addColumn("app_id", "text", col => col.notNull())
		.addColumn("key", "text", col => col.notNull())
		.addColumn("value", "text", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.addForeignKeyConstraint("fk_env_store_org_id_orgs_id", ["org_id"], "orgs", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint(
			"fk_env_store_env_type_id_env_type_id",
			["env_type_id"],
			"env_type",
			["id"],
			cb => cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint("fk_env_store_app_id_app_id", ["app_id"], "app", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.execute();

	await db.schema.createIndex("env_store_org_id_idx").on("env_store").column("org_id").execute();

	await db.schema
		.createIndex("env_store_org_id_to_env_type_id_idx")
		.on("env_store")
		.columns(["org_id", "env_type_id"])
		.execute();

	await db.schema
		.createTable("audit_log")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("org_id", "text", col => col.notNull())
		.addColumn("user_id", "text", col => col.notNull())
		.addColumn("action", "text", col => col.notNull())
		.addColumn("details", "text", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.addForeignKeyConstraint("fk_audit_log_org_id_orgs_id", ["org_id"], "orgs", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint("fk_audit_log_user_id_users_id", ["user_id"], "users", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("audit_log").execute();
	await db.schema.dropTable("env_store").execute();
	await db.schema.dropTable("env_type").execute();
	await db.schema.dropTable("app").execute();
	await db.schema.dropTable("invite_user").execute();
	await db.schema.dropTable("invite_org").execute();
	await db.schema.dropTable("users").execute();
	await db.schema.dropTable("org_role").execute();
	await db.schema.dropTable("orgs").execute();
}

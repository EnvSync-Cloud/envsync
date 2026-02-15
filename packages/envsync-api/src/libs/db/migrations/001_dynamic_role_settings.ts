import { Kysely } from "kysely";

import { type Database } from "@/types/db";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.createTable("settings")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("user_id", "text", col => col.notNull())
		.addColumn("email_notifications", "boolean", col => col.notNull().defaultTo(true))
		.addColumn("theme", "text", col => col.notNull().defaultTo("dark"))
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.addForeignKeyConstraint("fk_settings_user_id_users_id", ["user_id"], "users", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.execute();

	await db.schema
		.alterTable("org_role")
		.addColumn("is_admin", "boolean", col => col.notNull().defaultTo(false))
		.execute();

	await db.schema
		.alterTable("org_role")
		.addColumn("can_view", "boolean", col => col.notNull().defaultTo(false))
		.execute();

	await db.schema
		.alterTable("org_role")
		.addColumn("can_edit", "boolean", col => col.notNull().defaultTo(false))
		.execute();

	await db.schema
		.alterTable("org_role")
		.addColumn("have_billing_options", "boolean", col => col.notNull().defaultTo(false))
		.execute();

	await db.schema
		.alterTable("org_role")
		.addColumn("have_api_access", "boolean", col => col.notNull().defaultTo(false))
		.execute();

	await db.schema
		.alterTable("org_role")
		.addColumn("have_webhook_access", "boolean", col => col.notNull().defaultTo(false))
		.execute();

	await db.schema
		.alterTable("org_role")
		.addColumn("is_master", "boolean", col => col.defaultTo(false))
		.execute();

	await db.schema
		.createTable("api_keys")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("user_id", "text", col => col.notNull())
		.addColumn("org_id", "text", col => col.notNull())
		.addColumn("description", "text")
		.addColumn("is_active", "boolean", col => col.notNull().defaultTo(true))
		.addColumn("key", "text", col => col.notNull().unique())
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.addForeignKeyConstraint("fk_api_keys_user_id_users_id", ["user_id"], "users", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint("fk_api_keys_org_id_orgs_id", ["org_id"], "orgs", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.execute();

	await db.schema.alterTable("orgs").addUniqueConstraint("uq_orgs_slug", ["slug"]).execute();

	await db.schema.alterTable("users").addUniqueConstraint("uq_users_email", ["email"]).execute();

	// invite_user
	await db.schema
		.alterTable("invite_user")
		.addUniqueConstraint("uq_invite_user_email", ["email"])
		.execute();

	// invite_org
	await db.schema
		.alterTable("invite_org")
		.addUniqueConstraint("uq_invite_org_email", ["email"])
		.execute();

	await db.schema
		.alterTable("env_type")
		.addUniqueConstraint("uq_env_type_org_id_name", ["org_id", "name"])
		.execute();

	await db.schema
		.alterTable("app")
		.addUniqueConstraint("uq_app_org_id_name", ["org_id", "name"])
		.execute();

	await db.schema
		.alterTable("env_store")
		.addUniqueConstraint("uq_env_store_org_id_env_type_id_app_id_key", [
			"org_id",
			"env_type_id",
			"app_id",
			"key",
		])
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.dropTable("settings").execute();

	await db.schema.alterTable("org_role").dropColumn("is_admin").execute();

	await db.schema.alterTable("org_role").dropColumn("can_view").execute();

	await db.schema.alterTable("org_role").dropColumn("can_edit").execute();

	await db.schema.alterTable("org_role").dropColumn("have_billing_options").execute();

	await db.schema.alterTable("org_role").dropColumn("have_api_access").execute();

	await db.schema.alterTable("org_role").dropColumn("have_webhook_access").execute();

	await db.schema.alterTable("org_role").dropColumn("is_master").execute();

	await db.schema.dropTable("api_keys").execute();

	await db.schema.alterTable("orgs").dropConstraint("uq_orgs_slug").execute();

	await db.schema.alterTable("users").dropConstraint("uq_users_email").execute();

	// invite_user
	await db.schema.alterTable("invite_user").dropConstraint("uq_invite_user_email").execute();

	// invite_org
	await db.schema.alterTable("invite_org").dropConstraint("uq_invite_org_email").execute();

	await db.schema.alterTable("env_type").dropConstraint("uq_env_type_org_id_name").execute();

	await db.schema.alterTable("app").dropConstraint("uq_app_org_id_name").execute();

	await db.schema
		.alterTable("env_store")
		.dropConstraint("uq_env_store_org_id_env_type_id_app_id_key")
		.execute();
}

import { Kysely } from "kysely";

import { type Database } from "@/types/db";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("app")
		.addColumn("enable_secrets", "boolean", col => col.defaultTo(false))
		.execute();

	await db.schema
		.alterTable("app")
		.addColumn("is_managed_secret", "boolean", col => col.defaultTo(false))
		.execute();

	await db.schema.alterTable("app").addColumn("private_key", "text").execute();

	await db.schema.alterTable("app").addColumn("public_key", "text").execute();

	await db.schema
		.createTable("env_store_pit")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("change_request_message", "text")
		.addColumn("org_id", "text")
		.addColumn("env_type_id", "text")
		.addColumn("user_id", "text")
		.addColumn("app_id", "text")
		.addColumn("created_at", "timestamp", col => col.defaultTo("now()"))
		.addColumn("updated_at", "timestamp", col => col.defaultTo("now()"))
		.addForeignKeyConstraint("fk_env_store_pit_org", ["org_id"], "orgs", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint("fk_env_store_pit_env_type", ["env_type_id"], "env_type", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint("fk_env_store_pit_user", ["user_id"], "users", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint("fk_env_store_pit_app", ["app_id"], "app", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.execute();

	await db.schema
		.createTable("env_store_pit_change_request")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("env_store_pit_id", "text")
		.addColumn("key", "text")
		.addColumn("value", "text")
		.addColumn("operation", "text", col => col.notNull())
		.addColumn("created_at", "timestamp", col => col.defaultTo("now()"))
		.addColumn("updated_at", "timestamp", col => col.defaultTo("now()"))
		.addForeignKeyConstraint(
			"fk_env_store_pit_change_request_env_store_pit",
			["env_store_pit_id"],
			"env_store_pit",
			["id"],
			cb => cb.onDelete("cascade"),
		)
		.execute();

	await db.schema
		.createTable("secret_store")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("org_id", "text")
		.addColumn("env_type_id", "text")
		.addColumn("app_id", "text")
		.addColumn("key", "text")
		.addColumn("value", "text")
		.addColumn("created_at", "timestamp", col => col.defaultTo("now()"))
		.addColumn("updated_at", "timestamp", col => col.defaultTo("now()"))
		.addForeignKeyConstraint("fk_secret_store_org", ["org_id"], "orgs", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint("fk_secret_store_env_type", ["env_type_id"], "env_type", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint("fk_secret_store_app", ["app_id"], "app", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.execute();

	await db.schema
		.createTable("secret_store_pit")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("change_request_message", "text")
		.addColumn("org_id", "text")
		.addColumn("env_type_id", "text")
		.addColumn("user_id", "text")
		.addColumn("app_id", "text")
		.addColumn("created_at", "timestamp", col => col.defaultTo("now()"))
		.addColumn("updated_at", "timestamp", col => col.defaultTo("now()"))
		.addForeignKeyConstraint("fk_secret_store_pit_org", ["org_id"], "orgs", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint(
			"fk_secret_store_pit_env_type",
			["env_type_id"],
			"env_type",
			["id"],
			cb => cb.onDelete("cascade"),
		)
		.addForeignKeyConstraint("fk_secret_store_pit_user", ["user_id"], "users", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.execute();

	await db.schema
		.createTable("secret_store_pit_change_request")
		.addColumn("id", "text", col => col.primaryKey().notNull())
		.addColumn("secret_store_pit_id", "text")
		.addColumn("key", "text")
		.addColumn("value", "text")
		.addColumn("operation", "text", col => col.notNull())
		.addColumn("created_at", "timestamp", col => col.defaultTo("now()"))
		.addColumn("updated_at", "timestamp", col => col.defaultTo("now()"))
		.addForeignKeyConstraint(
			"fk_secret_store_pit_change_request_secret_store_pit",
			["secret_store_pit_id"],
			"secret_store_pit",
			["id"],
			cb => cb.onDelete("cascade"),
		)
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("app").dropColumn("enable_secrets").execute();

	await db.schema.alterTable("app").dropColumn("is_managed_secret").execute();

	await db.schema.alterTable("app").dropColumn("public_key").execute();

	await db.schema.dropTable("env_store_pit_change_request").execute();
	await db.schema.dropTable("env_store_pit").execute();
	await db.schema.dropTable("secret_store_pit_change_request").execute();
	await db.schema.dropTable("secret_store_pit").execute();
	await db.schema.dropTable("secret_store").execute();
}

import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable("provider_connection")
		.ifNotExists()
		.addColumn("id", "text", col => col.primaryKey())
		.addColumn("org_id", "text", col => col.notNull().references("orgs.id").onDelete("cascade"))
		.addColumn("provider_type", "text", col => col.notNull())
		.addColumn("name", "text", col => col.notNull())
		.addColumn("status", "text", col => col.notNull().defaultTo("active"))
		.addColumn("auth_config", "jsonb", col => col.notNull())
		.addColumn("metadata", "jsonb", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.execute();

	await db.schema
		.createTable("org_secret")
		.ifNotExists()
		.addColumn("id", "text", col => col.primaryKey())
		.addColumn("org_id", "text", col => col.notNull().references("orgs.id").onDelete("cascade"))
		.addColumn("key", "text", col => col.notNull())
		.addColumn("value", "text", col => col.notNull())
		.addColumn("description", "text")
		.addColumn("metadata", "jsonb", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.execute();

	await db.schema
		.createTable("integration_binding")
		.ifNotExists()
		.addColumn("id", "text", col => col.primaryKey())
		.addColumn("org_id", "text", col => col.notNull().references("orgs.id").onDelete("cascade"))
		.addColumn("app_id", "text", col => col.notNull().references("app.id").onDelete("cascade"))
		.addColumn("provider_connection_id", "text", col => col.notNull().references("provider_connection.id").onDelete("cascade"))
		.addColumn("provider_type", "text", col => col.notNull())
		.addColumn("is_enabled", "boolean", col => col.notNull().defaultTo(true))
		.addColumn("metadata", "jsonb", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.execute();

	await db.schema
		.createTable("env_type_mapping")
		.ifNotExists()
		.addColumn("id", "text", col => col.primaryKey())
		.addColumn("org_id", "text", col => col.notNull().references("orgs.id").onDelete("cascade"))
		.addColumn("app_id", "text", col => col.notNull().references("app.id").onDelete("cascade"))
		.addColumn("env_type_id", "text", col => col.notNull().references("env_type.id").onDelete("cascade"))
		.addColumn("integration_binding_id", "text", col => col.notNull().references("integration_binding.id").onDelete("cascade"))
		.addColumn("target_identifier", "text", col => col.notNull())
		.addColumn("branch_ref", "text")
		.addColumn("path_prefix", "text")
		.addColumn("metadata", "jsonb", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.execute();

	await db.schema
		.createTable("sync_run")
		.ifNotExists()
		.addColumn("id", "text", col => col.primaryKey())
		.addColumn("org_id", "text", col => col.notNull().references("orgs.id").onDelete("cascade"))
		.addColumn("app_id", "text", col => col.references("app.id").onDelete("cascade"))
		.addColumn("provider_type", "text", col => col.notNull())
		.addColumn("status", "text", col => col.notNull().defaultTo("pending"))
		.addColumn("actor_user_id", "text", col => col.references("users.id").onDelete("set null"))
		.addColumn("started_at", "timestamptz", col => col.notNull())
		.addColumn("completed_at", "timestamptz")
		.addColumn("error_message", "text")
		.addColumn("metadata", "jsonb", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.execute();

	await db.schema
		.createTable("sync_audit_event")
		.ifNotExists()
		.addColumn("id", "text", col => col.primaryKey())
		.addColumn("org_id", "text", col => col.notNull().references("orgs.id").onDelete("cascade"))
		.addColumn("sync_run_id", "text", col => col.references("sync_run.id").onDelete("cascade"))
		.addColumn("app_id", "text", col => col.references("app.id").onDelete("cascade"))
		.addColumn("env_type_id", "text", col => col.references("env_type.id").onDelete("cascade"))
		.addColumn("provider_type", "text", col => col.notNull())
		.addColumn("action", "text", col => col.notNull())
		.addColumn("result", "text", col => col.notNull())
		.addColumn("actor_user_id", "text", col => col.references("users.id").onDelete("set null"))
		.addColumn("details", "jsonb", col => col.notNull())
		.addColumn("created_at", "timestamptz", col => col.notNull())
		.addColumn("updated_at", "timestamptz", col => col.notNull())
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("sync_audit_event").ifExists().execute();
	await db.schema.dropTable("sync_run").ifExists().execute();
	await db.schema.dropTable("env_type_mapping").ifExists().execute();
	await db.schema.dropTable("integration_binding").ifExists().execute();
	await db.schema.dropTable("org_secret").ifExists().execute();
	await db.schema.dropTable("provider_connection").ifExists().execute();
}

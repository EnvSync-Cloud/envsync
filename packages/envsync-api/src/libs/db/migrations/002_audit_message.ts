import { Kysely } from "kysely";

import { type Database } from "@/types/db";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("audit_log").addColumn("message", "text").execute();

	await db.schema.alterTable("env_type").addColumn("app_id", "text").execute();

	await db.schema
		.alterTable("env_type")
		.addForeignKeyConstraint("fk_env_type_app_id", ["app_id"], "app", ["id"], cb =>
			cb.onDelete("cascade"),
		)
		.execute();

	await db.schema
		.alterTable("env_type")
		.addColumn("is_default", "boolean", col => col.notNull().defaultTo(false))
		.execute();

	await db.schema
		.alterTable("env_type")
		.addColumn("is_protected", "boolean", col => col.notNull().defaultTo(false))
		.execute();

	await db.schema
		.alterTable("env_type")
		.addColumn("color", "text", col => col.notNull().defaultTo("#000000"))
		.execute();

	await db.schema.alterTable("env_type").dropConstraint("uq_env_type_org_id_name").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("audit_log").dropColumn("message").execute();

	await db.schema.alterTable("env_type").dropColumn("app_id").execute();

	await db.schema.alterTable("env_type").dropColumn("is_default").execute();

	await db.schema.alterTable("env_type").dropColumn("is_protected").execute();

	await db.schema.alterTable("env_type").dropColumn("color").execute();

	await db.schema
		.alterTable("env_type")
		.addUniqueConstraint("uq_env_type_org_id_name", ["org_id", "name"])
		.execute();
}

import { Kysely } from "kysely";

import { type Database } from "envsync-api/ports/types-db";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
        .createTable("log_forwarding_configs")
        .addColumn("id", "text", col => col.primaryKey().notNull())
        .addColumn("org_id", "text", col => col.notNull())
        .addColumn("provider_type", "text", col => col.notNull())
        .addColumn("name", "text", col => col.notNull())
        .addColumn("config", "jsonb", col => col.notNull())
        .addColumn("enabled", "boolean", col => col.notNull().defaultTo(true))
        .addColumn("created_at", "timestamp", col => col.notNull().defaultTo("now()"))
        .addColumn("updated_at", "timestamp", col => col.notNull().defaultTo("now()"))
        .addForeignKeyConstraint(
            "fk_log_forwarding_configs_org_id_orgs_id",
            ["org_id"],
            "orgs",
            ["id"],
            cb => cb.onDelete("cascade"),
        )
        .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("log_forwarding_configs").execute();
}

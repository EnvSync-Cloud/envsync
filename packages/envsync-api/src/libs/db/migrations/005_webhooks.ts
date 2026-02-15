import { Kysely } from "kysely";

import { type Database } from "@/types/db";

export async function up(db: Kysely<Database>): Promise<void> {
    await db.schema
    .createTable("webhook_store")
    .addColumn("id", "text", col => col.primaryKey().notNull())
    .addColumn("name", "text", col => col.notNull())
    .addColumn("org_id", "text", col => col.notNull())
    .addColumn("user_id", "text", col => col.notNull())
    .addColumn("url", "text", col => col.notNull())
    .addColumn("event_types", "jsonb", col => col.notNull().defaultTo("[]"))
    .addColumn("is_active", "boolean", col => col.notNull().defaultTo(false))
    .addColumn("webhook_type", "text", col => col.notNull())
    .addColumn("app_id", "text")
    .addColumn("linked_to", "text", col => col.notNull().defaultTo("org"))
    .addColumn("last_triggered_at", "timestamp")
    .addColumn("created_at", "timestamp", col => col.notNull().defaultTo("now()"))
    .addColumn("updated_at", "timestamp", col => col.notNull().defaultTo("now()"))
    .addForeignKeyConstraint("fk_webhook_store_org_id_orgs_id", ["org_id"], "orgs", ["id"], cb =>
        cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint("fk_webhook_store_user_id_users_id", ["user_id"], "users", ["id"], cb =>
        cb.onDelete("cascade"),
    )
    .addForeignKeyConstraint("fk_webhook_store_app_id_app_id", ["app_id"], "app", ["id"], cb =>
        cb.onDelete("cascade"),
    )
    .execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
    await db.schema.dropTable("webhook_store").execute();
}

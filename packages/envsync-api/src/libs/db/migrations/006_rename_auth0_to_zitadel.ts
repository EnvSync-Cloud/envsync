import { Kysely } from "kysely";

import { type Database } from "@/types/db";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("users").renameColumn("auth0_id", "auth_service_id").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("users").renameColumn("auth_service_id", "auth0_id").execute();
}

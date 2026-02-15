import { Kysely } from "kysely";

import { type Database } from "@/types/db";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("users").renameColumn("auth0_id", "keycloak_id").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("users").renameColumn("keycloak_id", "auth0_id").execute();
}

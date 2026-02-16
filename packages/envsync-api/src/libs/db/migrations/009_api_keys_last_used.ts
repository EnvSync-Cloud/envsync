import { Kysely } from "kysely";

import { type Database } from "@/types/db";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema
		.alterTable("api_keys")
		.addColumn("last_used_at", "timestamptz")
		.execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("api_keys").dropColumn("last_used_at").execute();
}

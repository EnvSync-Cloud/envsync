import { Kysely, sql } from "kysely";

import { type Database } from "@/types/db";

export async function up(db: Kysely<Database>): Promise<void> {
	// Rename live data tables to legacy (keep for rollback safety)
	await sql`ALTER TABLE env_store RENAME TO env_store_legacy`.execute(db);
	await sql`ALTER TABLE secret_store RENAME TO secret_store_legacy`.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
	// Rename legacy tables back
	await sql`ALTER TABLE env_store_legacy RENAME TO env_store`.execute(db);
	await sql`ALTER TABLE secret_store_legacy RENAME TO secret_store`.execute(db);
}

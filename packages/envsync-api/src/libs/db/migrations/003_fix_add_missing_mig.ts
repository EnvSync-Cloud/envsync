import { Kysely } from "kysely";

import { type Database } from "@/types/db";

export async function up(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("org_role").addColumn("color", "text").execute();
}

export async function down(db: Kysely<Database>): Promise<void> {
	await db.schema.alterTable("org_role").dropColumn("color").execute();
}

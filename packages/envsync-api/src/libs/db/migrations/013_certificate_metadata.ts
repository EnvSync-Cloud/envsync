import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`ALTER TABLE org_certificates ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb`.execute(
		db,
	);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`ALTER TABLE org_certificates DROP COLUMN metadata`.execute(db);
}

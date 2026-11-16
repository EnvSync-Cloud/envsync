import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		ALTER TABLE api_keys
			ADD COLUMN IF NOT EXISTS key_hint text
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`ALTER TABLE api_keys DROP COLUMN IF EXISTS key_hint`.execute(db);
}

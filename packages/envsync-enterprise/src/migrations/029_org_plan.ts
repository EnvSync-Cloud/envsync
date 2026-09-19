import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		ALTER TABLE org_feature_grant
			ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'developer'
	`.execute(db);
	await sql`
		ALTER TABLE org_feature_grant
			ADD COLUMN IF NOT EXISTS limits jsonb
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`ALTER TABLE org_feature_grant DROP COLUMN IF EXISTS limits`.execute(db);
	await sql`ALTER TABLE org_feature_grant DROP COLUMN IF EXISTS plan`.execute(db);
}

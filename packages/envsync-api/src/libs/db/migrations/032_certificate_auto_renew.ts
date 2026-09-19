import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		ALTER TABLE org_certificates
			ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false,
			ADD COLUMN IF NOT EXISTS renew_days_before integer NOT NULL DEFAULT 30
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`
		ALTER TABLE org_certificates
			DROP COLUMN IF EXISTS auto_renew,
			DROP COLUMN IF EXISTS renew_days_before
	`.execute(db);
}

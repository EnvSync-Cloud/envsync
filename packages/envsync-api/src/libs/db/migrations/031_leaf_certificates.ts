import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		ALTER TABLE org_certificates
			ADD COLUMN IF NOT EXISTS app_id text,
			ADD COLUMN IF NOT EXISTS env_type_id text,
			ADD COLUMN IF NOT EXISTS sans text[] NOT NULL DEFAULT '{}'
	`.execute(db);
	await sql`
		CREATE INDEX IF NOT EXISTS idx_org_certificates_app_id ON org_certificates (app_id)
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP INDEX IF EXISTS idx_org_certificates_app_id`.execute(db);
	await sql`
		ALTER TABLE org_certificates
			DROP COLUMN IF EXISTS app_id,
			DROP COLUMN IF EXISTS env_type_id,
			DROP COLUMN IF EXISTS sans
	`.execute(db);
}

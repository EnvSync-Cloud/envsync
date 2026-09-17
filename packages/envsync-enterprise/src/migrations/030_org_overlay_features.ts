import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		ALTER TABLE org_feature_grant
			ADD COLUMN IF NOT EXISTS overlay_features text[] NOT NULL DEFAULT '{}'
	`.execute(db);

	await sql`CREATE SCHEMA IF NOT EXISTS ops`.execute(db);
	await sql`
		CREATE TABLE IF NOT EXISTS ops.audit (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			actor_email text NOT NULL,
			action text NOT NULL,
			org_id text,
			user_id text,
			payload jsonb NOT NULL DEFAULT '{}'::jsonb,
			created_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);
	await sql`
		CREATE INDEX IF NOT EXISTS ops_audit_created_at_idx ON ops.audit (created_at DESC)
	`.execute(db);
	await sql`
		CREATE INDEX IF NOT EXISTS ops_audit_org_id_idx ON ops.audit (org_id)
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP TABLE IF EXISTS ops.audit`.execute(db);
	await sql`DROP SCHEMA IF EXISTS ops`.execute(db);
	await sql`ALTER TABLE org_feature_grant DROP COLUMN IF EXISTS overlay_features`.execute(db);
}

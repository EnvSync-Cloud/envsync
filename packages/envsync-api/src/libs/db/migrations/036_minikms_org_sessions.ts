import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`
		CREATE TABLE IF NOT EXISTS minikms_org_sessions (
			org_id text PRIMARY KEY,
			session_token text NOT NULL,
			member_serial text NOT NULL DEFAULT '',
			created_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`DROP TABLE IF EXISTS minikms_org_sessions`.execute(db);
}

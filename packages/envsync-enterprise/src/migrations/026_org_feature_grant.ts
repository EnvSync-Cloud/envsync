import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE TABLE IF NOT EXISTS org_feature_grant (
			org_id text PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
			features text[] NOT NULL,
			source text NOT NULL DEFAULT 'billing',
			updated_by text,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP TABLE IF EXISTS org_feature_grant`.execute(db);
}

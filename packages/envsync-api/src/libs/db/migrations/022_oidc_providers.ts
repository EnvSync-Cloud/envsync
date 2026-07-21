import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE TABLE IF NOT EXISTS oidc_providers (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id text NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
			provider_type text NOT NULL CHECK (provider_type IN ('github_actions', 'gitlab_ci', 'kubernetes', 'generic')),
			issuer_url text NOT NULL,
			audience text NOT NULL,
			enabled boolean NOT NULL DEFAULT true,
			allowed_subjects jsonb NOT NULL DEFAULT '[]'::jsonb,
			machine_user_id text REFERENCES users(id) ON DELETE SET NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);

	await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_oidc_providers_org_issuer ON oidc_providers(org_id, issuer_url)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_oidc_providers_issuer ON oidc_providers(issuer_url) WHERE enabled = true`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP TABLE IF EXISTS oidc_providers`.execute(db);
}

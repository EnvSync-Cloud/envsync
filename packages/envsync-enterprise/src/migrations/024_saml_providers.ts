import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE TABLE IF NOT EXISTS saml_providers (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id text NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
			provider_type text NOT NULL CHECK (provider_type IN (
				'okta', 'onelogin', 'azure-ad', 'google-workspace',
				'duo', 'rippling', 'oracle', 'ping-identity'
			)),
			name text NOT NULL,
			entity_id text NOT NULL,
			sso_url text NOT NULL,
			certificate text NOT NULL,
			enabled boolean NOT NULL DEFAULT true,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);

	await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_saml_providers_org_entity ON saml_providers(org_id, entity_id)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_saml_providers_org_id ON saml_providers(org_id)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP TABLE IF EXISTS saml_providers`.execute(db);
}

import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`ALTER TABLE saml_providers ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false`.execute(db);
	await sql`ALTER TABLE saml_providers ADD COLUMN IF NOT EXISTS last_sso_at timestamptz`.execute(db);
	await sql`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_saml_providers_one_default_per_org
		ON saml_providers (org_id)
		WHERE is_default = true
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP INDEX IF EXISTS idx_saml_providers_one_default_per_org`.execute(db);
	await sql`ALTER TABLE saml_providers DROP COLUMN IF EXISTS last_sso_at`.execute(db);
	await sql`ALTER TABLE saml_providers DROP COLUMN IF EXISTS is_default`.execute(db);
}

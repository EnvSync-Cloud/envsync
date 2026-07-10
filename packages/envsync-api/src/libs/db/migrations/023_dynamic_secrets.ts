import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE TABLE IF NOT EXISTS dynamic_secret_engines (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id text NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
			engine_type text NOT NULL CHECK (engine_type IN ('postgres', 'mysql', 'aws-iam', 'azure-sp')),
			name text NOT NULL,
			config jsonb NOT NULL DEFAULT '{}',
			enabled boolean NOT NULL DEFAULT true,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);

	await sql`
		CREATE TABLE IF NOT EXISTS dynamic_secret_leases (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			engine_id uuid NOT NULL REFERENCES dynamic_secret_engines(id) ON DELETE CASCADE,
			app_id text NOT NULL REFERENCES app(id) ON DELETE CASCADE,
			env_type_id text NOT NULL REFERENCES env_type(id) ON DELETE CASCADE,
			variable_key text NOT NULL,
			credential_data jsonb NOT NULL DEFAULT '{}',
			expires_at timestamptz NOT NULL,
			revoked_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);

	await sql`CREATE INDEX IF NOT EXISTS idx_dynamic_secret_engines_org_id ON dynamic_secret_engines(org_id)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_dynamic_secret_leases_engine_id ON dynamic_secret_leases(engine_id)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_dynamic_secret_leases_app_id ON dynamic_secret_leases(app_id)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_dynamic_secret_leases_expires_at ON dynamic_secret_leases(expires_at)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP TABLE IF EXISTS dynamic_secret_leases`.execute(db);
	await sql`DROP TABLE IF EXISTS dynamic_secret_engines`.execute(db);
}

import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE TABLE IF NOT EXISTS org_kms_config (
			org_id text PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
			source text NOT NULL CHECK (source IN ('managed', 'aws-kms', 'gcp-kms', 'azure-kv')),
			status text NOT NULL CHECK (status IN (
				'active', 'pending', 'rotating', 'unavailable', 'disabled'
			)),
			key_ref text,
			region text,
			credential_secret_id text REFERENCES org_secret(id),
			wrapped_kek bytea,
			kek_version int NOT NULL DEFAULT 1,
			last_verified_at timestamptz,
			last_error text,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);

	await sql`
		CREATE TABLE IF NOT EXISTS org_kms_rewrap_job (
			id uuid PRIMARY KEY,
			org_id text NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
			app_id text,
			kind text NOT NULL CHECK (kind IN ('kek_rewrap', 'dek_rewrap', 'detach_managed')),
			status text NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
			progress jsonb NOT NULL DEFAULT '{}',
			error_message text,
			created_by text,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);

	await sql`
		CREATE UNIQUE INDEX IF NOT EXISTS org_kms_rewrap_job_one_active
		ON org_kms_rewrap_job (org_id)
		WHERE status IN ('pending', 'running')
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP INDEX IF EXISTS org_kms_rewrap_job_one_active`.execute(db);
	await sql`DROP TABLE IF EXISTS org_kms_rewrap_job`.execute(db);
	await sql`DROP TABLE IF EXISTS org_kms_config`.execute(db);
}

import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE TABLE IF NOT EXISTS rotation_policies (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id text NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
			app_id text NOT NULL REFERENCES app(id) ON DELETE CASCADE,
			env_type_id text NOT NULL REFERENCES env_type(id) ON DELETE CASCADE,
			variable_key text NOT NULL,
			engine_type text NOT NULL CHECK (engine_type IN ('postgres', 'mysql', 'aws-iam', 'azure-sp')),
			schedule_cron text NOT NULL,
			dual_window_minutes integer NOT NULL DEFAULT 60,
			enabled boolean NOT NULL DEFAULT true,
			last_rotated_at timestamptz,
			next_rotation_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);

	await sql`
		CREATE TABLE IF NOT EXISTS rotation_state (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			rotation_policy_id uuid NOT NULL REFERENCES rotation_policies(id) ON DELETE CASCADE,
			old_credential_encrypted text,
			new_credential_encrypted text NOT NULL,
			rotated_at timestamptz NOT NULL DEFAULT now(),
			old_credential_expires_at timestamptz NOT NULL,
			old_credential_revoked boolean NOT NULL DEFAULT false,
			revoked_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);

	await sql`CREATE INDEX IF NOT EXISTS idx_rotation_policies_org_id ON rotation_policies(org_id)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_rotation_policies_app_id ON rotation_policies(app_id)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_rotation_policies_next_rotation ON rotation_policies(next_rotation_at) WHERE enabled = true`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_rotation_state_policy_id ON rotation_state(rotation_policy_id)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_rotation_state_expires ON rotation_state(old_credential_expires_at) WHERE old_credential_revoked = false`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP TABLE IF EXISTS rotation_state`.execute(db);
	await sql`DROP TABLE IF EXISTS rotation_policies`.execute(db);
}

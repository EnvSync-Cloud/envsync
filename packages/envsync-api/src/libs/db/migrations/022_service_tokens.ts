import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE TABLE IF NOT EXISTS service_tokens (
			id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			org_id text NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
			created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name text NOT NULL,
			token_hash text NOT NULL UNIQUE,
			app_id text REFERENCES app(id) ON DELETE SET NULL,
			env_type_id text REFERENCES env_type(id) ON DELETE SET NULL,
			permissions jsonb NOT NULL DEFAULT '{"read": true, "write": false}',
			expires_at timestamptz NOT NULL,
			last_used_at timestamptz,
			created_at timestamptz NOT NULL DEFAULT now(),
			updated_at timestamptz NOT NULL DEFAULT now()
		)
	`.execute(db);

	await sql`CREATE INDEX IF NOT EXISTS idx_service_tokens_org_id ON service_tokens(org_id)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_service_tokens_token_hash ON service_tokens(token_hash)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_service_tokens_app_id ON service_tokens(app_id)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP TABLE IF EXISTS service_tokens`.execute(db);
}

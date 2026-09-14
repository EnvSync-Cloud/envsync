import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		ALTER TABLE service_tokens
			ADD COLUMN IF NOT EXISTS scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
			ADD COLUMN IF NOT EXISTS rotated_from_id uuid REFERENCES service_tokens(id) ON DELETE SET NULL,
			ADD COLUMN IF NOT EXISTS grace_until timestamptz
	`.execute(db);

	await sql`
		UPDATE service_tokens
		SET scopes = CASE
			WHEN env_type_id IS NOT NULL THEN jsonb_build_array(
				jsonb_build_object('env_type_id', env_type_id, 'path', '/')
			)
			ELSE '[{"path":"/"}]'::jsonb
		END
		WHERE scopes = '[]'::jsonb
	`.execute(db);

	await sql`
		CREATE INDEX IF NOT EXISTS idx_service_tokens_rotated_from_id
		ON service_tokens(rotated_from_id)
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP INDEX IF EXISTS idx_service_tokens_rotated_from_id`.execute(db);
	await sql`
		ALTER TABLE service_tokens
			DROP COLUMN IF EXISTS grace_until,
			DROP COLUMN IF EXISTS rotated_from_id,
			DROP COLUMN IF EXISTS scopes
	`.execute(db);
}

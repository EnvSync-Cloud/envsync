import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE TABLE IF NOT EXISTS session_devices (
			id text PRIMARY KEY,
			directory_user_id text NOT NULL,
			user_id text REFERENCES users(id) ON DELETE SET NULL,
			client_id text NOT NULL,
			jkt text NOT NULL,
			label text NOT NULL,
			created_at timestamptz NOT NULL DEFAULT now(),
			last_used_at timestamptz NOT NULL DEFAULT now(),
			revoked_at timestamptz
		)
	`.execute(db);

	await sql`
		CREATE UNIQUE INDEX IF NOT EXISTS session_devices_active_jkt
			ON session_devices (directory_user_id, jkt)
			WHERE revoked_at IS NULL
	`.execute(db);

	await sql`
		CREATE INDEX IF NOT EXISTS session_devices_directory_user
			ON session_devices (directory_user_id)
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP TABLE IF EXISTS session_devices`.execute(db);
}

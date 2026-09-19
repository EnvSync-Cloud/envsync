import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`
		CREATE TABLE IF NOT EXISTS org_acme_eab (
			id text PRIMARY KEY,
			org_id text NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
			kid text NOT NULL UNIQUE,
			hmac_key text NOT NULL,
			created_by text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at timestamptz NOT NULL,
			updated_at timestamptz NOT NULL
		)
	`.execute(db);
	await sql`
		CREATE TABLE IF NOT EXISTS acme_accounts (
			id text PRIMARY KEY,
			org_id text NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
			eab_id text NOT NULL REFERENCES org_acme_eab(id) ON DELETE CASCADE,
			jwk_thumbprint text NOT NULL,
			contacts jsonb NOT NULL DEFAULT '[]',
			created_at timestamptz NOT NULL,
			updated_at timestamptz NOT NULL
		)
	`.execute(db);
	await sql`
		CREATE TABLE IF NOT EXISTS acme_orders (
			id text PRIMARY KEY,
			org_id text NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
			account_id text NOT NULL REFERENCES acme_accounts(id) ON DELETE CASCADE,
			status text NOT NULL,
			identifiers jsonb NOT NULL,
			csr_pem text,
			cert_id text,
			expires_at timestamptz NOT NULL,
			created_at timestamptz NOT NULL,
			updated_at timestamptz NOT NULL
		)
	`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_org_acme_eab_org_id ON org_acme_eab (org_id)`.execute(db);
	await sql`CREATE INDEX IF NOT EXISTS idx_acme_orders_org_id ON acme_orders (org_id)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`DROP TABLE IF EXISTS acme_orders`.execute(db);
	await sql`DROP TABLE IF EXISTS acme_accounts`.execute(db);
	await sql`DROP TABLE IF EXISTS org_acme_eab`.execute(db);
}

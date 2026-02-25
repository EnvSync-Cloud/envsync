import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await sql`ALTER TABLE org_role ADD COLUMN have_gpg_access boolean NOT NULL DEFAULT false`.execute(db);
	await sql`ALTER TABLE org_role ADD COLUMN have_cert_access boolean NOT NULL DEFAULT false`.execute(db);
	await sql`ALTER TABLE org_role ADD COLUMN have_audit_access boolean NOT NULL DEFAULT false`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`ALTER TABLE org_role DROP COLUMN have_gpg_access`.execute(db);
	await sql`ALTER TABLE org_role DROP COLUMN have_cert_access`.execute(db);
	await sql`ALTER TABLE org_role DROP COLUMN have_audit_access`.execute(db);
}

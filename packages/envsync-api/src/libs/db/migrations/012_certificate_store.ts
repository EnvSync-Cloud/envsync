import { type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable("org_certificates")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("org_id", "text", (col) =>
			col.notNull().references("orgs.id").onDelete("cascade"),
		)
		.addColumn("user_id", "text", (col) =>
			col.notNull().references("users.id").onDelete("cascade"),
		)
		.addColumn("serial_hex", "text", (col) => col.notNull().unique())
		.addColumn("cert_type", "text", (col) => col.notNull())
		.addColumn("subject_cn", "text", (col) => col.notNull())
		.addColumn("subject_email", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
		.addColumn("not_before", "timestamptz")
		.addColumn("not_after", "timestamptz")
		.addColumn("description", "text")
		.addColumn("revoked_at", "timestamptz")
		.addColumn("revocation_reason", "integer")
		.addColumn("created_at", "timestamptz", (col) => col.notNull())
		.addColumn("updated_at", "timestamptz", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_org_certificates_org_id")
		.on("org_certificates")
		.column("org_id")
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("org_certificates").execute();
}

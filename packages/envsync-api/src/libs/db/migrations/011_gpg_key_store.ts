import { type Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	await db.schema
		.createTable("gpg_keys")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("org_id", "text", (col) =>
			col.notNull().references("orgs.id").onDelete("cascade"),
		)
		.addColumn("user_id", "text", (col) =>
			col.notNull().references("users.id").onDelete("cascade"),
		)
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("email", "text", (col) => col.notNull())
		.addColumn("fingerprint", "text", (col) => col.notNull().unique())
		.addColumn("key_id", "text", (col) => col.notNull())
		.addColumn("algorithm", "text", (col) => col.notNull())
		.addColumn("key_size", "integer")
		.addColumn("public_key", "text", (col) => col.notNull())
		.addColumn("private_key_ref", "text", (col) => col.notNull())
		.addColumn("usage_flags", "jsonb", (col) => col.notNull())
		.addColumn("trust_level", "text", (col) =>
			col.notNull().defaultTo("ultimate"),
		)
		.addColumn("expires_at", "timestamptz")
		.addColumn("revoked_at", "timestamptz")
		.addColumn("revocation_reason", "text")
		.addColumn("is_default", "boolean", (col) => col.defaultTo(false))
		.addColumn("created_at", "timestamptz", (col) => col.notNull())
		.addColumn("updated_at", "timestamptz", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_gpg_keys_org_id")
		.on("gpg_keys")
		.column("org_id")
		.execute();

	await db.schema
		.createIndex("idx_gpg_keys_org_user")
		.on("gpg_keys")
		.columns(["org_id", "user_id"])
		.execute();

	await db.schema
		.createIndex("idx_gpg_keys_key_id")
		.on("gpg_keys")
		.column("key_id")
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema.dropTable("gpg_keys").execute();
}

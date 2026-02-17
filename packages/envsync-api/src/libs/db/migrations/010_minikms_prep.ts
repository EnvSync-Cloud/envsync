import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
	// Add hash chaining columns to audit_log (Issue #11)
	await db.schema
		.alterTable("audit_log")
		.addColumn("previous_hash", "text")
		.execute();

	await db.schema
		.alterTable("audit_log")
		.addColumn("entry_hash", "text")
		.execute();

	// Add KMS tracking columns to app table
	await db.schema
		.alterTable("app")
		.addColumn("kms_key_version_id", "text")
		.execute();

	await db.schema
		.alterTable("app")
		.addColumn("encryption_migrated", "boolean", (col) =>
			col.defaultTo(false),
		)
		.execute();
}

export async function down(db: Kysely<any>): Promise<void> {
	await db.schema
		.alterTable("app")
		.dropColumn("encryption_migrated")
		.execute();

	await db.schema
		.alterTable("app")
		.dropColumn("kms_key_version_id")
		.execute();

	await db.schema
		.alterTable("audit_log")
		.dropColumn("entry_hash")
		.execute();

	await db.schema
		.alterTable("audit_log")
		.dropColumn("previous_hash")
		.execute();
}

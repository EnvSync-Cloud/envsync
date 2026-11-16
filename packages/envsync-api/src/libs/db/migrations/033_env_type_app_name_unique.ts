import { sql, type Kysely } from "kysely";

type DuplicateEnvName = {
	app_id: string;
	name: string;
	count: number | string;
};

export async function up(db: Kysely<any>): Promise<void> {
	const duplicates = await sql<DuplicateEnvName>`
		SELECT app_id, name, COUNT(*)::int AS count
		FROM env_type
		WHERE app_id IS NOT NULL
		GROUP BY app_id, name
		HAVING COUNT(*) > 1
		ORDER BY app_id, name
	`.execute(db);

	if (duplicates.rows.length > 0) {
		const lines = duplicates.rows.map(
			row => `app_id=${row.app_id} name=${JSON.stringify(row.name)} count=${row.count}`,
		);
		throw new Error(
			"Cannot add uq_env_type_app_id_name. These projects already have more than one environment with the same name:\n" +
				lines.join("\n"),
		);
	}

	await sql`
		ALTER TABLE env_type
			ADD CONSTRAINT uq_env_type_app_id_name UNIQUE (app_id, name)
	`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
	await sql`
		ALTER TABLE env_type DROP CONSTRAINT IF EXISTS uq_env_type_app_id_name
	`.execute(db);
}

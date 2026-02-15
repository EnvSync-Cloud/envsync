import { DB } from "../src/libs/db";

import { sql } from "kysely";
import { argv } from "bun";

const args = argv.slice(2);

for (const arg of args) {
	switch (arg) {
		case "restore": {
			await DB.restore();

			break;
		}
		case "backup": {
			await DB.backup();

			break;
		}
		case "list": {
			const migrator = await DB.migrator();

			const migrations = await migrator.getMigrations();

			const migrationTable = migrations.map(migration => {
				return {
					name: migration.name,
					executedAt: migration.executedAt,
				};
			});

			console.table(migrationTable);

			break;
		}

		case "latest": {
			const migrator = await DB.migrator();
			const response = await migrator.migrateToLatest();
			console.table(response);

			break;
		}

		case "migrate_to": {
			const migrator = await DB.migrator();
			const migrate_to = args[1];

			if (!migrate_to) {
				console.log("Invalid migration name");
				break;
			}

			const response = await migrator.migrateTo(migrate_to);
			console.table(response);

			break;
		}

		case "rollback": {
			const migrator = await DB.migrator();
			const response = await migrator.migrateDown();
			console.table(response);

			break;
		}

		case "step": {
			const migrator = await DB.migrator();
			const response = await migrator.migrateUp();
			console.table(response);

			break;
		}

		case "drop": {
			const db = await DB.getInstance();
			const response = await sql`DROP SCHEMA public CASCADE`.execute(db);
			console.log(response);

			break;
		}

		case "init": {
			const db = await DB.getInstance();
			const response = await sql`
                    CREATE SCHEMA public;
                    GRANT ALL ON SCHEMA public TO public;
                `.execute(db);

			console.log(response);

			break;
		}

		default: {
			const commands = {
				backup: "Backup current data into local json file",
				restore: "Reseed the database with the latest backup",
				list: "List all migrations",
				latest: "Migrate to latest migration",
				"migrate_to 'file_name'": "Migrate to a specific migration",
				rollback: "Rollback one migration",
				step: "Migrate one migration",
				drop: "Drop the public schema",
				init: "Create the public schema",
			};

			console.table(commands);
		}
	}
}

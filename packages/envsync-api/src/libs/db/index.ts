import fs from "node:fs/promises";
import path from "node:path";

import { FileMigrationProvider, Kysely, Migrator, sql, type Expression,type OperationNode } from "kysely";

import infoLogs, { LogTypes } from "@/libs/logger";
import { type Database } from "@/types/db";
import { config } from "@/utils/env";

import { PostgresDB } from "./adapters/postgresql";

export class DB {
	private static kysely: Promise<Kysely<Database>> | undefined;
	private static kysely_migration: Promise<Migrator> | undefined;

	static getInstance(): Promise<Kysely<Database>> {
		this.kysely ??= this._getInstance();

		return this.kysely;
	}

	static async _getInstance(): Promise<Kysely<Database>> {
		const kysely: Kysely<Database> = await PostgresDB.getInstance();

		await this.migrate(kysely, config.DB_AUTO_MIGRATE === "true");

		return kysely;
	}

	static get poolSize(): number {
		return PostgresDB.poolSize;
	}

	static get availableConnections(): number {
		return PostgresDB.availableConnections;
	}

	static async migrate(kysely: Kysely<Database>, auto_migrate: boolean) {
		if (!auto_migrate) {
			return;
		}
		const migrator = new Migrator({
			db: kysely as any,
			provider: new FileMigrationProvider({
				fs,
				path,
				migrationFolder: new URL(import.meta.resolve("./migrations")).pathname,
			}),
		});

		infoLogs("Running migrations...", LogTypes.LOGS, "DB:Kysely");

		const { results, error } = (await migrator.migrateToLatest()) as {
			results: { migrationName: string; status: string }[] | null;
			error: Error | null;
		};

		if (error) {
			infoLogs(error.message, LogTypes.CUSTOMOBJ, "DB:Kysely");
		} else if (results?.length) {
			infoLogs("Migrations finished!", LogTypes.LOGS, "DB:Kysely");
			for (const { migrationName, status } of results) {
				infoLogs(`  - ${migrationName}: ${status}`, LogTypes.LOGS, "DB:Kysely");
			}
		} else {
			infoLogs("Everything up-to-date.", LogTypes.LOGS, "DB:Kysely");
		}
	}

	static async migrator() {
		this.kysely_migration ??= this._migrator();

		return this.kysely_migration;
	}

	static async _migrator() {
		const kysely = await this.getInstance();

		return new Migrator({
			db: kysely as any,
			provider: new FileMigrationProvider({
				fs,
				path,
				migrationFolder: new URL(import.meta.resolve("./migrations")).pathname,
			}),
		});
	}

	static async backup() {
		const db = await this.getInstance();

		const tables = await db.introspection.getTables();
		const publicTables = tables
			.filter(table => table.schema === "public" && !table.isView)
			.map(table => table.name);

		const data = await Promise.all(
			publicTables.map(async table => {
				const { rows } = await sql`SELECT * FROM ${sql.raw(table)}`.execute(db);

				const { rows: columns } =
					await sql`SELECT column_name, data_type FROM information_schema.columns WHERE
    table_name = '${sql.raw(table)}' AND table_schema = 'public'`.execute(db);

				return { [table]: { columns, rows } };
			}),
		);

		const backupFolder = path.join(__dirname, "backups");
		await fs.mkdir(backupFolder, { recursive: true });
		await fs.writeFile(
			path.join(backupFolder, `${new Date().getTime()}.json`),
			JSON.stringify(
				data.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
				null,
				2,
			),
		);
	}

	static async restore(backupFile?: string) {
		const backupFolder = path.join(__dirname, "backups");
		if (!backupFile) {
			try {
				const files = await fs.readdir(backupFolder);
				backupFile = files.toSorted().reverse()[0];
			} catch (e) {
				infoLogs("No backup files found", LogTypes.ERROR, "DB");
				return;
			}
		}

		const backup = JSON.parse(
			await fs.readFile(path.resolve(backupFolder, backupFile), "utf-8"),
		) as Record<string, { columns: object; rows: object }>;

		const db = await this.getInstance();
		for (const [table, { rows }] of Object.entries(backup)) {
			if (!Array.isArray(rows) || !rows.length) {
				continue;
			}

			// @ts-expect-error
			await db.insertInto(table).values(rows).execute();
		}
	}

	// run 'select 1' and return true if the database is reachable
	static async healthCheck() {
		const db = await this.getInstance();
		try {
			await sql`SELECT 1 as "status"`.execute(db);
			infoLogs("Database Connected", LogTypes.LOGS, "DB");
		} catch (error) {
			infoLogs("Database Unreachable", LogTypes.ERROR, "DB");
		}
	}
}

export class JsonValue<T> implements Expression<T> {
  #value: T

  constructor(value: T) {
    this.#value = value
  }

  get expressionType(): T | undefined {
    return undefined
  }

  toOperationNode(): OperationNode {
    const json = JSON.stringify(this.#value)
    return sql`CAST(${json} AS JSONB)`.toOperationNode()
  }
}
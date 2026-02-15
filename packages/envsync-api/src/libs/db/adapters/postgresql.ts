import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import { KyselyLogger } from "@/libs/db/KyselyLogger";
import type { Database } from "@/types/db";
import { config } from "@/utils/env";

/**
 * Postgres DB class to get the database instance
 */
export class PostgresDB {
	static db: Kysely<Database> | undefined;
	static postgres?: Pool;

	static async getInstance(): Promise<Kysely<Database>> {
		this.postgres ??= new Pool({
			database: config.DATABASE_NAME,
			host: config.DATABASE_HOST,
			user: config.DATABASE_USER,
			password: config.DATABASE_PASSWORD,
			port: Number(config.DATABASE_PORT),
			max: 10,
			ssl: config.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
		});

		this.db ??= new Kysely({
			dialect: new PostgresDialect({
				pool: this.postgres,
			}),
			log: KyselyLogger,
		});

		return this.db;
	}

	static get poolSize() {
		return this.postgres?.totalCount ?? 0;
	}

	static get availableConnections() {
		return this.postgres?.idleCount ?? 0;
	}
}

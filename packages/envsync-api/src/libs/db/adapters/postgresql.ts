import { Kysely, PostgresDialect } from "kysely";
import { Client, Pool } from "pg";

import { KyselyLogger } from "@/libs/db/KyselyLogger";
import infoLogs, { LogTypes } from "@/libs/logger";
import type { Database } from "@/types/db";
import { config } from "@/utils/env";

/**
 * Postgres DB class to get the database instance
 */
export class PostgresDB {
	static db: Kysely<Database> | undefined;
	static postgres?: Pool;

	static async getInstance(): Promise<Kysely<Database>> {
		if (process.env.E2E_DEBUG_AUTH === "1" && !this.postgres) {
			console.log(
				`[DB DEBUG] init host=${config.DATABASE_HOST} port=${config.DATABASE_PORT} db=${config.DATABASE_NAME} user=${config.DATABASE_USER}`,
			);
		}
		if (!this.postgres) {
			this.postgres = new Pool({
				database: config.DATABASE_NAME,
				host: config.DATABASE_HOST,
				user: config.DATABASE_USER,
				password: config.DATABASE_PASSWORD,
				port: Number(config.DATABASE_PORT),
				max: Number(process.env.DB_POOL_MAX ?? 25),
				idleTimeoutMillis: 30_000,
				connectionTimeoutMillis: 5_000,
				ssl: config.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
			});
			this.postgres.on("error", (err: Error) => {
				infoLogs(`Postgres pool error: ${err.message}`, LogTypes.ERROR, "DB");
			});
		}

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

	/** Short-lived probe so a down server does not cache a failed pool. */
	static async ping(): Promise<boolean> {
		const client = new Client({
			database: config.DATABASE_NAME,
			host: config.DATABASE_HOST,
			user: config.DATABASE_USER,
			password: config.DATABASE_PASSWORD,
			port: Number(config.DATABASE_PORT),
			connectionTimeoutMillis: 2_000,
			ssl: config.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
		});
		client.on("error", () => {
			// connect() rejects; the listener keeps a refused connection from crashing the process.
		});
		try {
			await client.connect();
			await client.query("SELECT 1");
			return true;
		} catch {
			return false;
		} finally {
			try {
				await client.end();
			} catch {
				// The probe client is disposable.
			}
		}
	}

	static async destroy() {
		if (this.db) {
			await this.db.destroy();
		} else if (this.postgres) {
			await this.postgres.end();
		}
		this.db = undefined;
		this.postgres = undefined;
	}
}

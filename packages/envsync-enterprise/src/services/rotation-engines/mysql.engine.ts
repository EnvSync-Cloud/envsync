import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import crypto from "node:crypto";
import mysql from "mysql2/promise";

/**
 * MySQL rotation engine.
 *
 * Creates a new MySQL user with a random password, grants the same
 * permissions as the current credential, then revokes the old user after
 * the dual-credential window.
 *
 * Expected connectionConfig:
 *   host: string
 *   port: number (default 3306)
 *   database: string
 *   admin_user: string
 *   admin_password: string (encrypted at rest)
 *   grant_template: string (SQL template for granting permissions)
 *   ssl: boolean (optional, default false)
 */
export class MySQLEngine implements RotationEngine {
	readonly engineType = "mysql";

	validateConfig(config: EngineConfig): void {
		const { connectionConfig } = config;
		if (!connectionConfig.host || typeof connectionConfig.host !== "string") {
			throw new Error("MySQLEngine: connectionConfig.host is required");
		}
		if (!connectionConfig.database || typeof connectionConfig.database !== "string") {
			throw new Error("MySQLEngine: connectionConfig.database is required");
		}
		if (!connectionConfig.admin_user || typeof connectionConfig.admin_user !== "string") {
			throw new Error("MySQLEngine: connectionConfig.admin_user is required");
		}
		if (!connectionConfig.admin_password || typeof connectionConfig.admin_password !== "string") {
			throw new Error("MySQLEngine: connectionConfig.admin_password is required");
		}
	}

	async generateCredential(config: EngineConfig): Promise<CredentialResult> {
		this.validateConfig(config);

		const { connectionConfig } = config;
		const username = `envsync_${crypto.randomBytes(8).toString("hex")}`;
		const password = crypto.randomBytes(32).toString("base64url");
		const port = (connectionConfig.port as number) || 3306;
		const useSsl = connectionConfig.ssl === true;

		let connection: mysql.Connection | undefined;
		try {
			connection = await mysql.createConnection({
				host: connectionConfig.host as string,
				port,
				user: connectionConfig.admin_user as string,
				password: connectionConfig.admin_password as string,
				database: connectionConfig.database as string,
				connectTimeout: 10_000,
				ssl: useSsl ? { rejectUnauthorized: false } : undefined,
			});

			// Create the user — mysql2.escapeId wraps identifiers in backticks
			await connection.query(
				`CREATE USER ${mysql.escapeId(username)}@'%' IDENTIFIED BY ?`,
				[password],
			);

			// Execute grant_template if provided (GRANT statements)
			const grantTemplate = connectionConfig.grant_template as string | undefined;
			if (grantTemplate && typeof grantTemplate === "string") {
				// Replace {{username}} placeholder in the template
				const grantSql = grantTemplate.replace(
					/\{\{username\}\}/g,
					`\`${username}\``,
				);
				await connection.query(grantSql);
			}

			await connection.query("FLUSH PRIVILEGES");

			const connectionString = `mysql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${connectionConfig.host}:${port}/${connectionConfig.database}`;

			return {
				credential: connectionString,
				metadata: {
					username,
					host: connectionConfig.host,
					port,
					database: connectionConfig.database,
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`MySQLEngine: failed to generate credential — ${message}`);
		} finally {
			if (connection) {
				await connection.end();
			}
		}
	}

	async revokeCredential(config: EngineConfig, credential: string): Promise<void> {
		const url = new URL(credential);
		const username = decodeURIComponent(url.username);

		if (!username) {
			throw new Error("MySQLEngine: cannot extract username from credential");
		}

		const { connectionConfig } = config;
		const port = (connectionConfig.port as number) || 3306;
		const useSsl = connectionConfig.ssl === true;

		let connection: mysql.Connection | undefined;
		try {
			connection = await mysql.createConnection({
				host: connectionConfig.host as string,
				port,
				user: connectionConfig.admin_user as string,
				password: connectionConfig.admin_password as string,
				database: connectionConfig.database as string,
				connectTimeout: 10_000,
				ssl: useSsl ? { rejectUnauthorized: false } : undefined,
			});

			await connection.query(`DROP USER IF EXISTS ${mysql.escapeId(username)}@'%'`);
			await connection.query("FLUSH PRIVILEGES");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`MySQLEngine: failed to revoke credential — ${message}`);
		} finally {
			if (connection) {
				await connection.end();
			}
		}
	}
}

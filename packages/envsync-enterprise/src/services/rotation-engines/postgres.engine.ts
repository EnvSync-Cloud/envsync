import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import crypto from "node:crypto";
import { Client } from "pg";

/**
 * PostgreSQL rotation engine.
 *
 * Creates a new PostgreSQL role with a random password, grants the same
 * permissions as the current credential, then revokes the old role after
 * the dual-credential window.
 *
 * Expected connectionConfig:
 *   host: string
 *   port: number (default 5432)
 *   database: string
 *   admin_user: string
 *   admin_password: string (encrypted at rest)
 *   role_template: string (SQL template for granting permissions)
 *   ssl: boolean (optional, default false)
 */
export class PostgresEngine implements RotationEngine {
	readonly engineType = "postgres";

	validateConfig(config: EngineConfig): void {
		const { connectionConfig } = config;
		if (!connectionConfig.host || typeof connectionConfig.host !== "string") {
			throw new Error("PostgresEngine: connectionConfig.host is required");
		}
		if (!connectionConfig.database || typeof connectionConfig.database !== "string") {
			throw new Error("PostgresEngine: connectionConfig.database is required");
		}
		if (!connectionConfig.admin_user || typeof connectionConfig.admin_user !== "string") {
			throw new Error("PostgresEngine: connectionConfig.admin_user is required");
		}
		if (!connectionConfig.admin_password || typeof connectionConfig.admin_password !== "string") {
			throw new Error("PostgresEngine: connectionConfig.admin_password is required");
		}
	}

	async generateCredential(config: EngineConfig): Promise<CredentialResult> {
		this.validateConfig(config);

		const { connectionConfig } = config;
		const username = `envsync_${crypto.randomBytes(8).toString("hex")}`;
		const password = crypto.randomBytes(32).toString("base64url");
		const port = (connectionConfig.port as number) || 5432;
		const useSsl = connectionConfig.ssl === true;

		const client = new Client({
			host: connectionConfig.host as string,
			port,
			database: connectionConfig.database as string,
			user: connectionConfig.admin_user as string,
			password: connectionConfig.admin_password as string,
			connectionTimeoutMillis: 10_000,
			ssl: useSsl ? { rejectUnauthorized: false } : false,
		});

		try {
			await client.connect();

			// Create the role with login capability
			// Using pg-format-style escaping via parameterized-safe identifier quoting
			const safeUsername = client.escapeIdentifier(username);
			const safePassword = password.replace(/'/g, "''");

			await client.query(
				`CREATE ROLE ${safeUsername} WITH LOGIN PASSWORD '${safePassword}'`,
			);

			// Execute role_template if provided (GRANT statements)
			const roleTemplate = connectionConfig.role_template as string | undefined;
			if (roleTemplate && typeof roleTemplate === "string") {
				// Replace {{username}} placeholder in the template
				const grantSql = roleTemplate.replace(/\{\{username\}\}/g, safeUsername);
				await client.query(grantSql);
			}

			const connectionString = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${connectionConfig.host}:${port}/${connectionConfig.database}`;

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
			throw new Error(`PostgresEngine: failed to generate credential — ${message}`);
		} finally {
			await client.end();
		}
	}

	async revokeCredential(config: EngineConfig, credential: string): Promise<void> {
		const url = new URL(credential);
		const username = decodeURIComponent(url.username);

		if (!username) {
			throw new Error("PostgresEngine: cannot extract username from credential");
		}

		const { connectionConfig } = config;
		const port = (connectionConfig.port as number) || 5432;
		const useSsl = connectionConfig.ssl === true;

		const client = new Client({
			host: connectionConfig.host as string,
			port,
			database: connectionConfig.database as string,
			user: connectionConfig.admin_user as string,
			password: connectionConfig.admin_password as string,
			connectionTimeoutMillis: 10_000,
			ssl: useSsl ? { rejectUnauthorized: false } : false,
		});

		try {
			await client.connect();

			const safeUsername = client.escapeIdentifier(username);

			// Transfer owned objects to the admin user, then drop
			await client.query(`REASSIGN OWNED BY ${safeUsername} TO ${client.escapeIdentifier(connectionConfig.admin_user as string)}`);
			await client.query(`DROP OWNED BY ${safeUsername}`);
			await client.query(`DROP ROLE IF EXISTS ${safeUsername}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`PostgresEngine: failed to revoke credential — ${message}`);
		} finally {
			await client.end();
		}
	}
}

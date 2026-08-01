import mysql from "mysql2/promise";
import infoLogs, { LogTypes } from "@/libs/logger";

import type { CredentialResult, DynamicSecretEngineInterface, TemplateVars } from "./base";
import { generatePassword, generateUsername, applyTemplate } from "./base";

interface MysqlConfig {
	host: string;
	port: number;
	database: string;
	superuser: { username: string; password: string };
	creation_statements: string[];
	revocation_statements?: string[];
	default_ttl_seconds: number;
	max_ttl_seconds: number;
}

/**
 * Dynamic-secret engine for MySQL / MariaDB.
 *
 * Creates temporary database users with the configured grants whose
 * lifecycle is tied to the lease TTL.
 */
export class MySQLEngine implements DynamicSecretEngineInterface {
	readonly engineType = "mysql";

	validateConfig(config: Record<string, unknown>): void {
		const c = config as unknown as MysqlConfig;
		if (!c.host) throw new Error("MySQLEngine: host is required");
		if (!c.database) throw new Error("MySQLEngine: database is required");
		if (!c.superuser?.username) throw new Error("MySQLEngine: superuser.username is required");
		if (!c.superuser?.password) throw new Error("MySQLEngine: superuser.password is required");
		if (!Array.isArray(c.creation_statements) || c.creation_statements.length === 0) {
			throw new Error("MySQLEngine: at least one creation statement is required");
		}
	}

	/**
	 * Create a mysql2 connection as the configured superuser.
	 */
	private async createSuperuserConnection(config: MysqlConfig): Promise<mysql.Connection> {
		return mysql.createConnection({
			host: config.host,
			port: config.port ?? 3306,
			database: config.database,
			user: config.superuser.username,
			password: config.superuser.password,
			connectTimeout: 10_000,
		});
	}

	async generateCredentials(
		config: Record<string, unknown>,
		ttlSeconds: number,
	): Promise<CredentialResult> {
		const c = config as unknown as MysqlConfig;
		this.validateConfig(config);

		const username = generateUsername("envsync");
		const password = generatePassword(32);
		const expiration = new Date(Date.now() + ttlSeconds * 1000).toISOString();

		const vars: TemplateVars = {
			name: username,
			password,
			expiration,
			database: c.database,
		};

		const connection = await this.createSuperuserConnection(c);
		try {
			for (const stmt of c.creation_statements) {
				const rendered = applyTemplate(stmt, vars);
				infoLogs(
					`MySQLEngine: executing: ${rendered}`,
					LogTypes.LOGS,
					"DynamicSecretEngine:MySQL",
				);
				await connection.execute(rendered);
			}

			infoLogs(
				`MySQLEngine: created user ${username} on ${c.host}:${c.port ?? 3306}/${c.database}`,
				LogTypes.LOGS,
				"DynamicSecretEngine:MySQL",
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : "unknown error";
			infoLogs(
				`MySQLEngine: failed to create user ${username}: ${message}`,
				LogTypes.ERROR,
				"DynamicSecretEngine:MySQL",
			);
			throw new Error(`MySQLEngine: credential creation failed: ${message}`);
		} finally {
			await connection.end();
		}

		return {
			username,
			password,
			host: c.host,
			port: c.port ?? 3306,
			database: c.database,
			connection_string: `mysql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${c.host}:${c.port ?? 3306}/${c.database}`,
		};
	}

	async revokeCredentials(
		config: Record<string, unknown>,
		credentialData: Record<string, unknown>,
	): Promise<void> {
		const c = config as unknown as MysqlConfig;
		const username = credentialData.username as string;

		if (!username) {
			infoLogs(
				"MySQLEngine: no username in credential data, skipping revocation",
				LogTypes.LOGS,
				"DynamicSecretEngine:MySQL",
			);
			return;
		}

		const vars: TemplateVars = {
			name: username,
			password: "",
			expiration: "",
			database: c.database,
		};

		let connection: mysql.Connection | undefined;
		try {
			connection = await this.createSuperuserConnection(c);

			// Use custom revocation statements if configured, otherwise default
			const revocationStmts = c.revocation_statements?.length
				? c.revocation_statements
				: [`DROP USER IF EXISTS '${username}'@'%'`];

			for (const stmt of revocationStmts) {
				const rendered = applyTemplate(stmt, vars);
				infoLogs(
					`MySQLEngine: executing revocation: ${rendered}`,
					LogTypes.LOGS,
					"DynamicSecretEngine:MySQL",
				);
				await connection.execute(rendered);
			}

			infoLogs(
				`MySQLEngine: revoked user ${username} on ${c.host}:${c.port ?? 3306}/${c.database}`,
				LogTypes.LOGS,
				"DynamicSecretEngine:MySQL",
			);
		} catch (err) {
			// Best-effort revocation — log but don't throw
			const message = err instanceof Error ? err.message : "unknown error";
			infoLogs(
				`MySQLEngine: failed to revoke user ${username}: ${message}`,
				LogTypes.ERROR,
				"DynamicSecretEngine:MySQL",
			);
		} finally {
			if (connection) await connection.end();
		}
	}
}

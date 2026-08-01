import { Client } from "pg";
import infoLogs, { LogTypes } from "envsync-api/ports/logger";

import type { CredentialResult, DynamicSecretEngineInterface, TemplateVars } from "./base";
import { generatePassword, generateUsername, applyTemplate } from "./base";

interface PostgresConfig {
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
 * Dynamic-secret engine for PostgreSQL.
 *
 * Creates temporary database users with LOGIN privileges whose password
 * expires after the lease TTL. Uses template-based SQL statements so that
 * operators can customise grants per engine instance.
 */
export class PostgresEngine implements DynamicSecretEngineInterface {
	readonly engineType = "postgres";

	validateConfig(config: Record<string, unknown>): void {
		const c = config as unknown as PostgresConfig;
		if (!c.host) throw new Error("PostgresEngine: host is required");
		if (!c.database) throw new Error("PostgresEngine: database is required");
		if (!c.superuser?.username) throw new Error("PostgresEngine: superuser.username is required");
		if (!c.superuser?.password) throw new Error("PostgresEngine: superuser.password is required");
		if (!Array.isArray(c.creation_statements) || c.creation_statements.length === 0) {
			throw new Error("PostgresEngine: at least one creation statement is required");
		}
	}

	/**
	 * Create a pg Client connected as the configured superuser.
	 */
	private createSuperuserClient(config: PostgresConfig): Client {
		return new Client({
			host: config.host,
			port: config.port ?? 5432,
			database: config.database,
			user: config.superuser.username,
			password: config.superuser.password,
			connectionTimeoutMillis: 10_000,
		});
	}

	async generateCredentials(
		config: Record<string, unknown>,
		ttlSeconds: number,
	): Promise<CredentialResult> {
		const c = config as unknown as PostgresConfig;
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

		const client = this.createSuperuserClient(c);
		try {
			await client.connect();

			for (const stmt of c.creation_statements) {
				const rendered = applyTemplate(stmt, vars);
				infoLogs(
					`PostgresEngine: executing: ${rendered}`,
					LogTypes.LOGS,
					"DynamicSecretEngine:Postgres",
				);
				await client.query(rendered);
			}

			infoLogs(
				`PostgresEngine: created user ${username} on ${c.host}:${c.port ?? 5432}/${c.database}`,
				LogTypes.LOGS,
				"DynamicSecretEngine:Postgres",
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : "unknown error";
			infoLogs(
				`PostgresEngine: failed to create user ${username}: ${message}`,
				LogTypes.ERROR,
				"DynamicSecretEngine:Postgres",
			);
			throw new Error(`PostgresEngine: credential creation failed: ${message}`);
		} finally {
			await client.end();
		}

		return {
			username,
			password,
			host: c.host,
			port: c.port ?? 5432,
			database: c.database,
			connection_string: `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${c.host}:${c.port ?? 5432}/${c.database}`,
		};
	}

	async revokeCredentials(
		config: Record<string, unknown>,
		credentialData: Record<string, unknown>,
	): Promise<void> {
		const c = config as unknown as PostgresConfig;
		const username = credentialData.username as string;

		if (!username) {
			infoLogs(
				"PostgresEngine: no username in credential data, skipping revocation",
				LogTypes.LOGS,
				"DynamicSecretEngine:Postgres",
			);
			return;
		}

		const vars: TemplateVars = {
			name: username,
			password: "",
			expiration: "",
			database: c.database,
		};

		const client = this.createSuperuserClient(c);
		try {
			await client.connect();

			// Use custom revocation statements if configured, otherwise default
			const revocationStmts = c.revocation_statements?.length
				? c.revocation_statements
				: [
						`REASSIGN OWNED BY "${username}" TO "${c.superuser.username}"`,
						`DROP OWNED BY "${username}"`,
						`DROP ROLE IF EXISTS "${username}"`,
					];

			for (const stmt of revocationStmts) {
				const rendered = applyTemplate(stmt, vars);
				infoLogs(
					`PostgresEngine: executing revocation: ${rendered}`,
					LogTypes.LOGS,
					"DynamicSecretEngine:Postgres",
				);
				await client.query(rendered);
			}

			infoLogs(
				`PostgresEngine: revoked user ${username} on ${c.host}:${c.port ?? 5432}/${c.database}`,
				LogTypes.LOGS,
				"DynamicSecretEngine:Postgres",
			);
		} catch (err) {
			// Best-effort revocation — log but don't throw
			const message = err instanceof Error ? err.message : "unknown error";
			infoLogs(
				`PostgresEngine: failed to revoke user ${username}: ${message}`,
				LogTypes.ERROR,
				"DynamicSecretEngine:Postgres",
			);
		} finally {
			await client.end();
		}
	}
}

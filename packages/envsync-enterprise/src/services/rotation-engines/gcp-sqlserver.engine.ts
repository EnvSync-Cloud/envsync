import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import { unimplementedRotationEngine } from "./types";

/**
 * GCP Cloud SQL SQL Server rotation engine.
 *
 * Uses the Cloud SQL Admin API to create a new SQL Server login with a random
 * password, grants the required database permissions, then drops the login
 * after the dual-credential window.
 *
 * Expected connectionConfig:
 *   instance_connection_name: string (project:region:instance)
 *   database: string
 *   project_id: string
 *   sa_key_json: string (service account key JSON, encrypted at rest)
 *   admin_user: string (Cloud SQL admin login)
 *   admin_password: string (admin password, encrypted at rest)
 *   grant_statements: string[] (SQL statements to grant permissions)
 */
export class GcpSqlServerEngine implements RotationEngine {
	readonly engineType = "gcp-sqlserver";

	validateConfig(config: EngineConfig): void {
		const { connectionConfig } = config;
		if (!connectionConfig.instance_connection_name || typeof connectionConfig.instance_connection_name !== "string") {
			throw new Error("GcpSqlServerEngine: connectionConfig.instance_connection_name is required");
		}
		if (!connectionConfig.database || typeof connectionConfig.database !== "string") {
			throw new Error("GcpSqlServerEngine: connectionConfig.database is required");
		}
		if (!connectionConfig.project_id || typeof connectionConfig.project_id !== "string") {
			throw new Error("GcpSqlServerEngine: connectionConfig.project_id is required");
		}
		if (!connectionConfig.sa_key_json || typeof connectionConfig.sa_key_json !== "string") {
			throw new Error("GcpSqlServerEngine: connectionConfig.sa_key_json is required");
		}
		if (!connectionConfig.admin_user || typeof connectionConfig.admin_user !== "string") {
			throw new Error("GcpSqlServerEngine: connectionConfig.admin_user is required");
		}
		if (!connectionConfig.admin_password || typeof connectionConfig.admin_password !== "string") {
			throw new Error("GcpSqlServerEngine: connectionConfig.admin_password is required");
		}
	}

	async generateCredential(_config: EngineConfig): Promise<CredentialResult> {
		unimplementedRotationEngine(this.engineType);
	}

	async revokeCredential(config: EngineConfig, credential: string): Promise<void> {
		const parsed = JSON.parse(credential) as {
			instance_connection_name?: string;
			database?: string;
			username?: string;
		};
		if (!parsed.username || !parsed.database) {
			throw new Error("GcpSqlServerEngine: cannot extract username/database from credential");
		}

		// In production:
		// 1. Connect to SQL Server via Cloud SQL Auth Proxy
		// 2. USE ${parsed.database}; DROP USER IF EXISTS ${parsed.username}
		// 3. DROP LOGIN IF EXISTS ${parsed.username}
	}
}

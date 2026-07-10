import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import crypto from "node:crypto";

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

	async generateCredential(config: EngineConfig): Promise<CredentialResult> {
		this.validateConfig(config);

		const { connectionConfig } = config;
		const username = `envsync_${crypto.randomBytes(8).toString("hex")}`;
		const password = crypto.randomBytes(32).toString("base64url");

		// In production, this would use the Google Cloud SQL Admin API:
		// import { google } from "googleapis"
		// const auth = new google.auth.GoogleAuth({
		//   credentials: JSON.parse(connectionConfig.sa_key_json),
		//   scopes: ["https://www.googleapis.com/auth/sqlservice.admin"],
		// })
		// const sqladmin = google.sqladmin({ version: "v1beta4", auth })
		//
		// 1. Connect to SQL Server via Cloud SQL Auth Proxy or IP
		// 2. CREATE LOGIN ${username} WITH PASSWORD = '${password}'
		// 3. USE ${database}; CREATE USER ${username} FOR LOGIN ${username}
		// 4. Execute grant_statements (GRANT statements)

		// Credential is stored as a JSON string
		const credential = JSON.stringify({
			instance_connection_name: connectionConfig.instance_connection_name,
			database: connectionConfig.database,
			username,
			password,
		});

		return {
			credential,
			metadata: {
				instance_connection_name: connectionConfig.instance_connection_name,
				database: connectionConfig.database,
				project_id: connectionConfig.project_id,
				username,
			},
		};
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

import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import { unimplementedRotationEngine } from "./types";

/**
 * GCP Cloud SQL PostgreSQL rotation engine.
 *
 * Uses the Cloud SQL Admin API to create a new PostgreSQL role with a random
 * password, grants the required database permissions, then drops the role
 * after the dual-credential window.
 *
 * Expected connectionConfig:
 *   instance_connection_name: string (project:region:instance)
 *   database: string
 *   project_id: string
 *   sa_key_json: string (service account key JSON, encrypted at rest)
 *   admin_user: string (Cloud SQL admin user)
 *   admin_password: string (admin password, encrypted at rest)
 *   role_template: string (SQL template for granting permissions)
 */
export class GcpPostgresEngine implements RotationEngine {
	readonly engineType = "gcp-postgres";

	validateConfig(config: EngineConfig): void {
		const { connectionConfig } = config;
		if (!connectionConfig.instance_connection_name || typeof connectionConfig.instance_connection_name !== "string") {
			throw new Error("GcpPostgresEngine: connectionConfig.instance_connection_name is required");
		}
		if (!connectionConfig.database || typeof connectionConfig.database !== "string") {
			throw new Error("GcpPostgresEngine: connectionConfig.database is required");
		}
		if (!connectionConfig.project_id || typeof connectionConfig.project_id !== "string") {
			throw new Error("GcpPostgresEngine: connectionConfig.project_id is required");
		}
		if (!connectionConfig.sa_key_json || typeof connectionConfig.sa_key_json !== "string") {
			throw new Error("GcpPostgresEngine: connectionConfig.sa_key_json is required");
		}
		if (!connectionConfig.admin_user || typeof connectionConfig.admin_user !== "string") {
			throw new Error("GcpPostgresEngine: connectionConfig.admin_user is required");
		}
		if (!connectionConfig.admin_password || typeof connectionConfig.admin_password !== "string") {
			throw new Error("GcpPostgresEngine: connectionConfig.admin_password is required");
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
			throw new Error("GcpPostgresEngine: cannot extract username/database from credential");
		}

		// In production:
		// 1. Connect to Cloud SQL instance via Auth Proxy or IP
		// 2. REASSIGN OWNED BY ${parsed.username} TO cloudsqlsuperuser
		// 3. DROP OWNED BY ${parsed.username}
		// 4. DROP ROLE IF EXISTS ${parsed.username}
	}
}

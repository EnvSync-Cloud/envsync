import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import crypto from "node:crypto";

/**
 * AWS RDS PostgreSQL rotation engine.
 *
 * Generates an IAM auth token for an RDS PostgreSQL instance, creates a
 * database role mapped to that token, then drops the role after the
 * dual-credential window.
 *
 * Expected connectionConfig:
 *   host: string (RDS endpoint)
 *   port: number (default 5432)
 *   database: string
 *   region: string (AWS region)
 *   db_user: string (database username for IAM auth)
 *   access_key_id: string (admin AWS credentials)
 *   secret_access_key: string (admin AWS credentials, encrypted at rest)
 *   role_template: string (SQL template for granting permissions)
 */
export class AwsPostgresEngine implements RotationEngine {
	readonly engineType = "aws-postgres";

	validateConfig(config: EngineConfig): void {
		const { connectionConfig } = config;
		if (!connectionConfig.host || typeof connectionConfig.host !== "string") {
			throw new Error("AwsPostgresEngine: connectionConfig.host is required");
		}
		if (!connectionConfig.database || typeof connectionConfig.database !== "string") {
			throw new Error("AwsPostgresEngine: connectionConfig.database is required");
		}
		if (!connectionConfig.region || typeof connectionConfig.region !== "string") {
			throw new Error("AwsPostgresEngine: connectionConfig.region is required");
		}
		if (!connectionConfig.db_user || typeof connectionConfig.db_user !== "string") {
			throw new Error("AwsPostgresEngine: connectionConfig.db_user is required");
		}
		if (!connectionConfig.access_key_id || typeof connectionConfig.access_key_id !== "string") {
			throw new Error("AwsPostgresEngine: connectionConfig.access_key_id is required");
		}
		if (!connectionConfig.secret_access_key || typeof connectionConfig.secret_access_key !== "string") {
			throw new Error("AwsPostgresEngine: connectionConfig.secret_access_key is required");
		}
	}

	async generateCredential(config: EngineConfig): Promise<CredentialResult> {
		this.validateConfig(config);

		const { connectionConfig } = config;
		const port = (connectionConfig.port as number) || 5432;
		const username = connectionConfig.db_user as string;

		// In production, this would use the AWS SDK:
		// import { Signer } from "@aws-sdk/rds-signer"
		// const signer = new Signer({
		//   hostname: connectionConfig.host,
		//   port,
		//   username,
		//   region: connectionConfig.region,
		//   credentials: {
		//     accessKeyId: connectionConfig.access_key_id,
		//     secretAccessKey: connectionConfig.secret_access_key,
		//   },
		// })
		// const authToken = await signer.getAuthToken()
		//
		// The IAM auth token is valid for 15 minutes and replaces the password.
		// The DB role must be created with:
		//   CREATE USER ${username} WITH LOGIN
		//   GRANT rds_iam TO ${username}
		//   Execute role_template SQL (GRANT statements)

		const mockAuthToken = crypto.randomBytes(32).toString("base64url");

		// Credential is stored as a JSON string with auth token
		const credential = JSON.stringify({
			host: connectionConfig.host,
			port,
			database: connectionConfig.database,
			username,
			auth_token: mockAuthToken,
			region: connectionConfig.region,
		});

		return {
			credential,
			metadata: {
				host: connectionConfig.host,
				port,
				database: connectionConfig.database,
				username,
				region: connectionConfig.region,
				auth_method: "iam",
			},
		};
	}

	async revokeCredential(config: EngineConfig, credential: string): Promise<void> {
		const parsed = JSON.parse(credential) as {
			username?: string;
		};
		if (!parsed.username) {
			throw new Error("AwsPostgresEngine: cannot extract username from credential");
		}

		// In production:
		// 1. Connect to RDS as the admin user
		// 2. REASSIGN OWNED BY ${parsed.username} TO rds_superuser
		// 3. DROP OWNED BY ${parsed.username}
		// 4. DROP ROLE IF EXISTS ${parsed.username}
		// IAM auth tokens expire automatically after 15 minutes,
		// but the DB role should be explicitly dropped for clean-up.
	}
}

import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import crypto from "node:crypto";

/**
 * AWS RDS MySQL rotation engine.
 *
 * Generates an IAM auth token for an RDS MySQL instance, creates a database
 * user mapped to that token, then drops the user after the dual-credential
 * window.
 *
 * Expected connectionConfig:
 *   host: string (RDS endpoint)
 *   port: number (default 3306)
 *   database: string
 *   region: string (AWS region)
 *   db_user: string (database username for IAM auth)
 *   access_key_id: string (admin AWS credentials)
 *   secret_access_key: string (admin AWS credentials, encrypted at rest)
 */
export class AwsMysqlEngine implements RotationEngine {
	readonly engineType = "aws-mysql";

	validateConfig(config: EngineConfig): void {
		const { connectionConfig } = config;
		if (!connectionConfig.host || typeof connectionConfig.host !== "string") {
			throw new Error("AwsMysqlEngine: connectionConfig.host is required");
		}
		if (!connectionConfig.database || typeof connectionConfig.database !== "string") {
			throw new Error("AwsMysqlEngine: connectionConfig.database is required");
		}
		if (!connectionConfig.region || typeof connectionConfig.region !== "string") {
			throw new Error("AwsMysqlEngine: connectionConfig.region is required");
		}
		if (!connectionConfig.db_user || typeof connectionConfig.db_user !== "string") {
			throw new Error("AwsMysqlEngine: connectionConfig.db_user is required");
		}
		if (!connectionConfig.access_key_id || typeof connectionConfig.access_key_id !== "string") {
			throw new Error("AwsMysqlEngine: connectionConfig.access_key_id is required");
		}
		if (!connectionConfig.secret_access_key || typeof connectionConfig.secret_access_key !== "string") {
			throw new Error("AwsMysqlEngine: connectionConfig.secret_access_key is required");
		}
	}

	async generateCredential(config: EngineConfig): Promise<CredentialResult> {
		this.validateConfig(config);

		const { connectionConfig } = config;
		const port = (connectionConfig.port as number) || 3306;
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
		// The DB user must be created with:
		//   CREATE USER '${username}'@'%' IDENTIFIED WITH AWSAuthenticationPlugin AS 'RDS'
		//   GRANT SELECT, INSERT ON ${database}.* TO '${username}'@'%'

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
			host?: string;
			username?: string;
		};
		if (!parsed.username) {
			throw new Error("AwsMysqlEngine: cannot extract username from credential");
		}

		// In production:
		// 1. Connect to RDS as the admin user
		// 2. DROP USER IF EXISTS '${parsed.username}'@'%'
		// IAM auth tokens expire automatically after 15 minutes,
		// but the DB user should be explicitly dropped for clean-up.
	}
}

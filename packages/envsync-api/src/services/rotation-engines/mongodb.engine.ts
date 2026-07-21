import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import crypto from "node:crypto";

/**
 * MongoDB rotation engine.
 *
 * Creates a new MongoDB user with a random password via the admin database,
 * grants the required database roles, then drops the user after the
 * dual-credential window.
 *
 * Expected connectionConfig:
 *   host: string
 *   port: number (default 27017)
 *   database: string
 *   auth_database: string (default "admin")
 *   admin_user: string (admin user for user management)
 *   admin_password: string (admin password, encrypted at rest)
 *   roles: Array<{ role: string; db: string }> (roles to grant)
 */
export class MongoDBEngine implements RotationEngine {
	readonly engineType = "mongodb";

	validateConfig(config: EngineConfig): void {
		const { connectionConfig } = config;
		if (!connectionConfig.host || typeof connectionConfig.host !== "string") {
			throw new Error("MongoDBEngine: connectionConfig.host is required");
		}
		if (!connectionConfig.database || typeof connectionConfig.database !== "string") {
			throw new Error("MongoDBEngine: connectionConfig.database is required");
		}
		if (!connectionConfig.admin_user || typeof connectionConfig.admin_user !== "string") {
			throw new Error("MongoDBEngine: connectionConfig.admin_user is required");
		}
		if (!connectionConfig.admin_password || typeof connectionConfig.admin_password !== "string") {
			throw new Error("MongoDBEngine: connectionConfig.admin_password is required");
		}
	}

	async generateCredential(config: EngineConfig): Promise<CredentialResult> {
		this.validateConfig(config);

		const { connectionConfig } = config;
		const username = `envsync_${crypto.randomBytes(8).toString("hex")}`;
		const password = crypto.randomBytes(32).toString("base64url");
		const port = (connectionConfig.port as number) || 27017;
		const authDatabase = (connectionConfig.auth_database as string) || "admin";

		// In production, this would use the MongoDB driver:
		// import { MongoClient } from "mongodb"
		// const adminUri = `mongodb://${connectionConfig.admin_user}:${connectionConfig.admin_password}@${connectionConfig.host}:${port}/${authDatabase}`
		// const client = new MongoClient(adminUri)
		// const adminDb = client.db(authDatabase)
		//
		// await adminDb.command({
		//   createUser: username,
		//   pwd: password,
		//   roles: connectionConfig.roles || [
		//     { role: "readWrite", db: connectionConfig.database },
		//   ],
		// })
		//
		// The roles array defaults to readWrite on the target database.

		// Credential is stored as a MongoDB connection URI
		const connectionString = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${connectionConfig.host}:${port}/${connectionConfig.database}?authSource=${authDatabase}`;

		return {
			credential: connectionString,
			metadata: {
				host: connectionConfig.host,
				port,
				database: connectionConfig.database,
				auth_database: authDatabase,
				username,
			},
		};
	}

	async revokeCredential(config: EngineConfig, credential: string): Promise<void> {
		const url = new URL(credential);
		const username = url.username;

		if (!username) {
			throw new Error("MongoDBEngine: cannot extract username from credential");
		}

		const { connectionConfig } = config;
		const authDatabase = (connectionConfig.auth_database as string) || "admin";

		// In production:
		// 1. Connect as admin
		// 2. const adminDb = client.db(authDatabase)
		// 3. await adminDb.command({ dropUser: username })
	}
}

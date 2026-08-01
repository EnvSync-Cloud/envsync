import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import crypto from "node:crypto";

/**
 * GCP Service Account rotation engine.
 *
 * Creates a new JSON key for a GCP service account, then deactivates
 * the old key after the dual-credential window.
 *
 * Expected connectionConfig:
 *   project_id: string (GCP project ID)
 *   service_account_email: string (e.g. my-sa@my-project.iam.gserviceaccount.com)
 *   admin_credentials: string (base64-encoded service-account JSON key for automation, encrypted at rest)
 */
export class GcpServiceAccountEngine implements RotationEngine {
	readonly engineType = "gcp-service-account";

	validateConfig(config: EngineConfig): void {
		const { connectionConfig } = config;
		if (!connectionConfig.project_id || typeof connectionConfig.project_id !== "string") {
			throw new Error("GcpServiceAccountEngine: connectionConfig.project_id is required");
		}
		if (!connectionConfig.service_account_email || typeof connectionConfig.service_account_email !== "string") {
			throw new Error("GcpServiceAccountEngine: connectionConfig.service_account_email is required");
		}
		if (!connectionConfig.admin_credentials || typeof connectionConfig.admin_credentials !== "string") {
			throw new Error("GcpServiceAccountEngine: connectionConfig.admin_credentials is required");
		}
	}

	async generateCredential(config: EngineConfig): Promise<CredentialResult> {
		this.validateConfig(config);

		const { connectionConfig } = config;

		// In production, this would use the Google IAM API:
		// 1. Authenticate with admin_credentials (service-account JSON key)
		// 2. POST https://iam.googleapis.com/v1/projects/{project}/serviceAccounts/{sa}/keys
		//    with { privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE" }
		//
		// For now, return a structured credential representing the service-account key
		const keyId = crypto.randomUUID();
		const privateKey = crypto.generateKeyPairSync("rsa", {
			modulusLength: 2048,
			publicKeyEncoding: { type: "spki", format: "pem" },
			privateKeyEncoding: { type: "pkcs8", format: "pem" },
		});

		const serviceAccountKey = JSON.stringify({
			type: "service_account",
			project_id: connectionConfig.project_id,
			private_key_id: keyId,
			private_key: privateKey.privateKey,
			client_email: connectionConfig.service_account_email,
			client_id: crypto.randomBytes(12).toString("hex"),
			auth_uri: "https://accounts.google.com/o/oauth2/auth",
			token_uri: "https://oauth2.googleapis.com/token",
		});

		return {
			credential: serviceAccountKey,
			metadata: {
				project_id: connectionConfig.project_id,
				service_account_email: connectionConfig.service_account_email,
				key_id: keyId,
			},
		};
	}

	async revokeCredential(config: EngineConfig, credential: string): Promise<void> {
		const parsed = JSON.parse(credential) as { private_key_id?: string };
		if (!parsed.private_key_id) {
			throw new Error("GcpServiceAccountEngine: cannot extract private_key_id from credential");
		}

		const { connectionConfig } = config;

		// In production:
		// 1. Authenticate with admin_credentials
		// 2. DELETE https://iam.googleapis.com/v1/projects/{project}/serviceAccounts/{sa}/keys/{keyId}
		void connectionConfig;
	}
}

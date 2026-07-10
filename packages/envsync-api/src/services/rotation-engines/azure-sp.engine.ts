import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import crypto from "node:crypto";

/**
 * Azure Service Principal rotation engine.
 *
 * Creates a new client secret for an Azure AD app registration,
 * then removes the old secret after the dual-credential window.
 *
 * Expected connectionConfig:
 *   tenant_id: string
 *   client_id: string (app registration client ID)
 *   client_secret: string (automation credentials, encrypted at rest)
 */
export class AzureSpEngine implements RotationEngine {
	readonly engineType = "azure-sp";

	validateConfig(config: EngineConfig): void {
		const { connectionConfig } = config;
		if (!connectionConfig.tenant_id || typeof connectionConfig.tenant_id !== "string") {
			throw new Error("AzureSpEngine: connectionConfig.tenant_id is required");
		}
		if (!connectionConfig.client_id || typeof connectionConfig.client_id !== "string") {
			throw new Error("AzureSpEngine: connectionConfig.client_id is required");
		}
		if (!connectionConfig.client_secret || typeof connectionConfig.client_secret !== "string") {
			throw new Error("AzureSpEngine: connectionConfig.client_secret is required");
		}
	}

	async generateCredential(config: EngineConfig): Promise<CredentialResult> {
		this.validateConfig(config);

		const { connectionConfig } = config;

		// In production, this would use the Microsoft Graph API:
		// 1. Authenticate with client credentials flow
		// 2. POST /applications/{app_object_id}/addPassword
		//    with { passwordCredential: { displayName: "envsync-rotation", endDateTime } }
		//
		// For now, return a structured credential
		const newSecret = crypto.randomBytes(32).toString("base64");
		const secretId = crypto.randomUUID();

		// Credential is stored as a JSON string with the secret details
		const credential = JSON.stringify({
			client_id: connectionConfig.client_id,
			client_secret: newSecret,
			secret_id: secretId,
		});

		return {
			credential,
			metadata: {
				tenant_id: connectionConfig.tenant_id,
				client_id: connectionConfig.client_id,
				secret_id: secretId,
			},
		};
	}

	async revokeCredential(config: EngineConfig, credential: string): Promise<void> {
		const parsed = JSON.parse(credential) as { secret_id?: string };
		if (!parsed.secret_id) {
			throw new Error("AzureSpEngine: cannot extract secret_id from credential");
		}

		// In production:
		// 1. Authenticate with client credentials flow
		// 2. DELETE /applications/{app_object_id}/removePassword
		//    with { keyId: parsed.secret_id }
	}
}

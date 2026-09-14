import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import { unimplementedRotationEngine } from "./types";

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

	async generateCredential(_config: EngineConfig): Promise<CredentialResult> {
		unimplementedRotationEngine(this.engineType);
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

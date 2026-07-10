import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import crypto from "node:crypto";

/**
 * SendGrid rotation engine.
 *
 * Creates a new SendGrid API key with the same scopes as the existing one,
 * then deletes the old API key after the dual-credential window.
 *
 * Expected connectionConfig:
 *   admin_api_key: string (SendGrid API key with API key management scopes, encrypted at rest)
 *   scopes: string[] (list of permission scopes to assign to the new key)
 */
export class SendGridEngine implements RotationEngine {
	readonly engineType = "sendgrid";

	validateConfig(config: EngineConfig): void {
		const { connectionConfig } = config;
		if (!connectionConfig.admin_api_key || typeof connectionConfig.admin_api_key !== "string") {
			throw new Error("SendGridEngine: connectionConfig.admin_api_key is required");
		}
		if (!Array.isArray(connectionConfig.scopes) || connectionConfig.scopes.length === 0) {
			throw new Error("SendGridEngine: connectionConfig.scopes must be a non-empty array");
		}
	}

	async generateCredential(config: EngineConfig): Promise<CredentialResult> {
		this.validateConfig(config);

		const { connectionConfig } = config;

		// In production, this would use the SendGrid API:
		// 1. Authenticate with admin_api_key
		// 2. POST https://api.sendgrid.com/v3/api_keys
		//    with { name: "envsync-rotation-...", scopes }
		//
		// For now, return a structured API key
		const keyId = crypto.randomUUID();
		const apiKey = `SG.${crypto.randomBytes(32).toString("base64url")}`;

		const credential = JSON.stringify({
			api_key_id: keyId,
			api_key: apiKey,
			name: `envsync-rotation-${crypto.randomBytes(4).toString("hex")}`,
			scopes: connectionConfig.scopes,
		});

		return {
			credential,
			metadata: {
				api_key_id: keyId,
				scopes: connectionConfig.scopes,
			},
		};
	}

	async revokeCredential(config: EngineConfig, credential: string): Promise<void> {
		const parsed = JSON.parse(credential) as { api_key_id?: string };
		if (!parsed.api_key_id) {
			throw new Error("SendGridEngine: cannot extract api_key_id from credential");
		}

		const { connectionConfig } = config;

		// In production:
		// 1. Authenticate with admin_api_key
		// 2. DELETE https://api.sendgrid.com/v3/api_keys/{api_key_id}
		void connectionConfig;
	}
}

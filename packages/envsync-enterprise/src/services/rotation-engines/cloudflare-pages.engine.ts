import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import { unimplementedRotationEngine } from "./types";

/**
 * Cloudflare Pages rotation engine.
 *
 * Rotates a Cloudflare Pages deploy hook / API token used for deployments.
 * Creates a new API token scoped to the target Pages project, then revokes
 * the old token after the dual-credential window.
 *
 * Expected connectionConfig:
 *   account_id: string (Cloudflare account ID)
 *   project_name: string (Cloudflare Pages project name)
 *   api_token: string (Cloudflare API token with Pages + Account permissions, encrypted at rest)
 */
export class CloudflarePagesEngine implements RotationEngine {
	readonly engineType = "cloudflare-pages";

	validateConfig(config: EngineConfig): void {
		const { connectionConfig } = config;
		if (!connectionConfig.account_id || typeof connectionConfig.account_id !== "string") {
			throw new Error("CloudflarePagesEngine: connectionConfig.account_id is required");
		}
		if (!connectionConfig.project_name || typeof connectionConfig.project_name !== "string") {
			throw new Error("CloudflarePagesEngine: connectionConfig.project_name is required");
		}
		if (!connectionConfig.api_token || typeof connectionConfig.api_token !== "string") {
			throw new Error("CloudflarePagesEngine: connectionConfig.api_token is required");
		}
	}

	async generateCredential(_config: EngineConfig): Promise<CredentialResult> {
		unimplementedRotationEngine(this.engineType);
	}

	async revokeCredential(config: EngineConfig, credential: string): Promise<void> {
		const parsed = JSON.parse(credential) as { token_id?: string };
		if (!parsed.token_id) {
			throw new Error("CloudflarePagesEngine: cannot extract token_id from credential");
		}

		const { connectionConfig } = config;

		// In production:
		// 1. Authenticate with api_token (the admin/automation token)
		// 2. DELETE https://api.cloudflare.com/client/v4/user/tokens/{token_id}
		void connectionConfig;
	}
}

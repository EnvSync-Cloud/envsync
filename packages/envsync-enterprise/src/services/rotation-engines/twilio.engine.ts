import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import { unimplementedRotationEngine } from "./types";

/**
 * Twilio rotation engine.
 *
 * Rotates the Auth Token for a Twilio account. Twilio supports
 * primary + secondary token rotation via the API, allowing zero-downtime
 * credential rotation during the dual-credential window.
 *
 * Expected connectionConfig:
 *   account_sid: string (Twilio Account SID)
 *   auth_token: string (current Twilio Auth Token, encrypted at rest)
 */
export class TwilioEngine implements RotationEngine {
	readonly engineType = "twilio";

	validateConfig(config: EngineConfig): void {
		const { connectionConfig } = config;
		if (!connectionConfig.account_sid || typeof connectionConfig.account_sid !== "string") {
			throw new Error("TwilioEngine: connectionConfig.account_sid is required");
		}
		if (!connectionConfig.auth_token || typeof connectionConfig.auth_token !== "string") {
			throw new Error("TwilioEngine: connectionConfig.auth_token is required");
		}
	}

	async generateCredential(_config: EngineConfig): Promise<CredentialResult> {
		unimplementedRotationEngine(this.engineType);
	}

	async revokeCredential(config: EngineConfig, credential: string): Promise<void> {
		const parsed = JSON.parse(credential) as { account_sid?: string };
		if (!parsed.account_sid) {
			throw new Error("TwilioEngine: cannot extract account_sid from credential");
		}

		const { connectionConfig } = config;

		// In production:
		// Twilio token rotation is atomic — promoting the secondary to primary
		// automatically invalidates the old primary. No explicit revoke call needed.
		// If using a separate token for this specific credential:
		// DELETE https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/AuthTokens/{TokenSid}.json
		void connectionConfig;
	}
}

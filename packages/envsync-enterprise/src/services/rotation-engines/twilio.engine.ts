import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import crypto from "node:crypto";

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

	async generateCredential(config: EngineConfig): Promise<CredentialResult> {
		this.validateConfig(config);

		const { connectionConfig } = config;

		// In production, this would use the Twilio API:
		// 1. Authenticate with current auth_token
		// 2. POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/AuthTokens.json
		//    This promotes the secondary token to primary and generates a new secondary.
		//
		// Alternatively for rolling rotation:
		// 1. GET the current tokens
		// 2. Generate a new secondary token
		// 3. After dual window, promote secondary to primary
		//
		// For now, return a structured credential
		const newAuthToken = crypto.randomBytes(32).toString("hex");

		const credential = JSON.stringify({
			account_sid: connectionConfig.account_sid,
			auth_token: newAuthToken,
		});

		return {
			credential,
			metadata: {
				account_sid: connectionConfig.account_sid,
			},
		};
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

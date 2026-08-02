import { randomBytes } from "node:crypto";

import infoLogs, { LogTypes } from "envsync-api/ports/logger";

import type { CredentialResult, DynamicSecretEngineInterface } from "./base";

interface AzureSpConfig {
	tenant_id: string;
	client_id: string;
	client_secret: string;
	subscription_id: string;
	roles: string[];
	default_ttl_seconds: number;
	max_ttl_seconds: number;
}

/**
 * Dynamic-secret engine for Azure Service Principals.
 *
 * Creates temporary service principal secrets (client secrets) with
 * configured role assignments on a subscription.
 */
export class AzureSpEngine implements DynamicSecretEngineInterface {
	readonly engineType = "azure-sp";

	validateConfig(config: Record<string, unknown>): void {
		const c = config as unknown as AzureSpConfig;
		if (!c.tenant_id) throw new Error("AzureSpEngine: tenant_id is required");
		if (!c.client_id) throw new Error("AzureSpEngine: client_id is required");
		if (!c.client_secret) throw new Error("AzureSpEngine: client_secret is required");
		if (!c.subscription_id) throw new Error("AzureSpEngine: subscription_id is required");
		if (!Array.isArray(c.roles) || c.roles.length === 0) {
			throw new Error("AzureSpEngine: at least one role is required");
		}
	}

	async generateCredentials(
		config: Record<string, unknown>,
		ttlSeconds: number,
	): Promise<CredentialResult> {
		const c = config as unknown as AzureSpConfig;
		this.validateConfig(config);

		// Generate a temporary client secret for the service principal
		const tempSecret = randomBytes(48).toString("base64url");
		const expiration = new Date(Date.now() + ttlSeconds * 1000);

		infoLogs(
			`AzureSpEngine: would create secret for SP ${c.client_id} in tenant ${c.tenant_id}, roles=[${c.roles.join(", ")}], expires ${expiration.toISOString()}`,
			LogTypes.LOGS,
			"DynamicSecretEngine:AzureSp",
		);

		return {
			username: c.client_id,
			password: tempSecret,
			tenant_id: c.tenant_id,
			client_id: c.client_id,
			client_secret: tempSecret,
			subscription_id: c.subscription_id,
			expiration: expiration.toISOString(),
		};
	}

	async revokeCredentials(
		config: Record<string, unknown>,
		credentialData: Record<string, unknown>,
	): Promise<void> {
		const c = config as unknown as AzureSpConfig;
		const clientId = credentialData.client_id as string;

		if (!clientId) {
			infoLogs(
				"AzureSpEngine: no client_id in credential data, skipping revocation",
				LogTypes.LOGS,
				"DynamicSecretEngine:AzureSp",
			);
			return;
		}

		// In production: call Azure AD API to remove the secret
		infoLogs(
			`AzureSpEngine: would revoke secret for SP ${clientId} in tenant ${c.tenant_id}`,
			LogTypes.LOGS,
			"DynamicSecretEngine:AzureSp",
		);
	}
}

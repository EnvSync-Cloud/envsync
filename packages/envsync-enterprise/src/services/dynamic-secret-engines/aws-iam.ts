import { randomBytes } from "node:crypto";

import infoLogs, { LogTypes } from "@/libs/logger";

import type { CredentialResult, DynamicSecretEngineInterface } from "./base";

interface AwsIamConfig {
	access_key_id: string;
	secret_access_key: string;
	region: string;
	iam_policy: string;
	default_ttl_seconds: number;
	max_ttl_seconds: number;
}

/**
 * Dynamic-secret engine for AWS IAM.
 *
 * Generates temporary IAM credentials (access key + secret key) scoped
 * to a specific IAM policy. In production this would call STS
 * AssumeRole or IAM CreateUser + attach policy.
 */
export class AwsIamEngine implements DynamicSecretEngineInterface {
	readonly engineType = "aws-iam";

	validateConfig(config: Record<string, unknown>): void {
		const c = config as unknown as AwsIamConfig;
		if (!c.access_key_id) throw new Error("AwsIamEngine: access_key_id is required");
		if (!c.secret_access_key) throw new Error("AwsIamEngine: secret_access_key is required");
		if (!c.region) throw new Error("AwsIamEngine: region is required");
		if (!c.iam_policy) throw new Error("AwsIamEngine: iam_policy is required");

		// Validate that the policy is valid JSON
		try {
			JSON.parse(c.iam_policy);
		} catch {
			throw new Error("AwsIamEngine: iam_policy must be valid JSON");
		}
	}

	async generateCredentials(
		config: Record<string, unknown>,
		ttlSeconds: number,
	): Promise<CredentialResult> {
		const c = config as unknown as AwsIamConfig;
		this.validateConfig(config);

		// Generate temporary credentials
		// In production: call AWS STS AssumeRole or IAM CreateUser
		const tempAccessKeyId = `AKIA${randomBytes(16).toString("hex").toUpperCase().slice(0, 16)}`;
		const tempSecretAccessKey = randomBytes(32).toString("base64").slice(0, 40);
		const sessionToken = randomBytes(64).toString("base64");
		const expiration = new Date(Date.now() + ttlSeconds * 1000);

		infoLogs(
			`AwsIamEngine: would create temporary credentials with policy in ${c.region}, expires ${expiration.toISOString()}`,
			LogTypes.LOGS,
			"DynamicSecretEngine:AwsIam",
		);

		return {
			username: tempAccessKeyId,
			password: tempSecretAccessKey,
			access_key_id: tempAccessKeyId,
			secret_access_key: tempSecretAccessKey,
			session_token: sessionToken,
			region: c.region,
			expiration: expiration.toISOString(),
		};
	}

	async revokeCredentials(
		_config: Record<string, unknown>,
		credentialData: Record<string, unknown>,
	): Promise<void> {
		const accessKeyId = credentialData.access_key_id as string;

		if (!accessKeyId) {
			infoLogs(
				"AwsIamEngine: no access_key_id in credential data, skipping revocation",
				LogTypes.LOGS,
				"DynamicSecretEngine:AwsIam",
			);
			return;
		}

		// In production: call IAM DeleteAccessKey or detach policy
		infoLogs(
			`AwsIamEngine: would revoke access key ${accessKeyId}`,
			LogTypes.LOGS,
			"DynamicSecretEngine:AwsIam",
		);
	}
}

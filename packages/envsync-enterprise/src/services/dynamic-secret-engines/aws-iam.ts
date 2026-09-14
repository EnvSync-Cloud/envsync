import infoLogs, { LogTypes } from "envsync-api/ports/logger";

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
		_config: Record<string, unknown>,
		_ttlSeconds: number,
	): Promise<CredentialResult> {
		throw new Error("aws-iam dynamic secret engine is not implemented");
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

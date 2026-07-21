import type { RotationEngine, EngineConfig, CredentialResult } from "./types";
import {
	IAMClient,
	CreateAccessKeyCommand,
	UpdateAccessKeyCommand,
	ListAccessKeysCommand,
} from "@aws-sdk/client-iam";

/**
 * AWS IAM rotation engine.
 *
 * Creates a new IAM access key for the specified user, then deactivates
 * the old access key after the dual-credential window.
 *
 * Expected connectionConfig:
 *   iam_user: string (IAM username)
 *   region: string
 *   access_key_id: string (admin/automation credentials)
 *   secret_access_key: string (admin/automation credentials, encrypted at rest)
 */
export class AwsIamEngine implements RotationEngine {
	readonly engineType = "aws-iam";

	validateConfig(config: EngineConfig): void {
		const { connectionConfig } = config;
		if (!connectionConfig.iam_user || typeof connectionConfig.iam_user !== "string") {
			throw new Error("AwsIamEngine: connectionConfig.iam_user is required");
		}
		if (!connectionConfig.region || typeof connectionConfig.region !== "string") {
			throw new Error("AwsIamEngine: connectionConfig.region is required");
		}
		if (!connectionConfig.access_key_id || typeof connectionConfig.access_key_id !== "string") {
			throw new Error("AwsIamEngine: connectionConfig.access_key_id is required");
		}
		if (!connectionConfig.secret_access_key || typeof connectionConfig.secret_access_key !== "string") {
			throw new Error("AwsIamEngine: connectionConfig.secret_access_key is required");
		}
	}

	private createClient(config: EngineConfig): IAMClient {
		return new IAMClient({
			region: config.connectionConfig.region as string,
			credentials: {
				accessKeyId: config.connectionConfig.access_key_id as string,
				secretAccessKey: config.connectionConfig.secret_access_key as string,
			},
		});
	}

	async generateCredential(config: EngineConfig): Promise<CredentialResult> {
		this.validateConfig(config);

		const { connectionConfig } = config;
		const iamUser = connectionConfig.iam_user as string;
		const iam = this.createClient(config);

		try {
			// Check current key count — IAM allows max 2 access keys per user
			const listResult = await iam.send(
				new ListAccessKeysCommand({ UserName: iamUser }),
			);

			const activeKeys = (listResult.AccessKeyMetadata ?? []).filter(
				(k) => k.Status === "Active",
			);

			if (activeKeys.length >= 2) {
				throw new Error(
					`AwsIamEngine: user ${iamUser} already has 2 active access keys. Revoke one before rotating.`,
				);
			}

			// Create a new access key
			const result = await iam.send(
				new CreateAccessKeyCommand({ UserName: iamUser }),
			);

			const accessKey = result.AccessKey;
			if (!accessKey?.AccessKeyId || !accessKey?.SecretAccessKey) {
				throw new Error("AwsIamEngine: AWS returned incomplete access key data");
			}

			// Credential is stored as a JSON string with both key components
			const credential = JSON.stringify({
				access_key_id: accessKey.AccessKeyId,
				secret_access_key: accessKey.SecretAccessKey,
			});

			return {
				credential,
				metadata: {
					iam_user: iamUser,
					access_key_id: accessKey.AccessKeyId,
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`AwsIamEngine: failed to generate credential — ${message}`);
		} finally {
			iam.destroy();
		}
	}

	async revokeCredential(config: EngineConfig, credential: string): Promise<void> {
		const parsed = JSON.parse(credential) as { access_key_id?: string };
		if (!parsed.access_key_id) {
			throw new Error("AwsIamEngine: cannot extract access_key_id from credential");
		}

		const { connectionConfig } = config;
		const iamUser = connectionConfig.iam_user as string;
		const iam = this.createClient(config);

		try {
			// Deactivate the old access key (not delete — allows audit trail)
			await iam.send(
				new UpdateAccessKeyCommand({
					UserName: iamUser,
					AccessKeyId: parsed.access_key_id,
					Status: "Inactive",
				}),
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`AwsIamEngine: failed to revoke credential — ${message}`);
		} finally {
			iam.destroy();
		}
	}
}

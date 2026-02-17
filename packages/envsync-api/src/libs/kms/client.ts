import { config } from "@/utils/env";
import infoLogs, { LogTypes } from "@/libs/logger";

/**
 * KMS Client wrapping miniKMS gRPC Encrypt/Decrypt/BatchEncrypt/BatchDecrypt RPCs.
 * Singleton pattern matching VaultClient.
 *
 * Maps EnvSync concepts to generic miniKMS concepts:
 *   orgId  → tenant_id
 *   appId  → scope_id
 */

export interface EncryptResult {
	ciphertext: string; // base64-encoded
	keyVersionId: string;
}

export interface DecryptResult {
	plaintext: string;
}

export interface BatchEncryptItem {
	plaintext: string;
	aad: string;
}

export interface BatchDecryptItem {
	ciphertext: string;
	aad: string;
	keyVersionId: string;
}

export class KMSClient {
	private static instance: KMSClient | null = null;
	private grpcAddr: string;
	private tlsEnabled: boolean;
	private tlsCaCert?: string;

	private constructor() {
		this.grpcAddr = config.MINIKMS_GRPC_ADDR;
		this.tlsEnabled = config.MINIKMS_TLS_ENABLED === "true";
		this.tlsCaCert = config.MINIKMS_TLS_CA_CERT;
	}

	public static async getInstance(): Promise<KMSClient> {
		if (!KMSClient.instance) {
			KMSClient.instance = new KMSClient();
			infoLogs(
				`KMS client initialized, connecting to ${KMSClient.instance.grpcAddr}`,
				LogTypes.LOGS,
				"KMSClient",
			);
		}
		return KMSClient.instance;
	}

	/**
	 * Encrypt a single value via miniKMS.
	 * Maps orgId → tenant_id, appId → scope_id for the generic KMS interface.
	 */
	public async encrypt(
		orgId: string,
		appId: string,
		plaintext: string,
		aad: string,
	): Promise<EncryptResult> {
		const response = await this.grpcCall("Encrypt", {
			tenant_id: orgId,
			scope_id: appId,
			plaintext: Buffer.from(plaintext, "utf-8").toString("base64"),
			aad,
		});

		return {
			ciphertext: response.ciphertext,
			keyVersionId: response.key_version_id,
		};
	}

	/**
	 * Decrypt a single value via miniKMS.
	 */
	public async decrypt(
		orgId: string,
		appId: string,
		ciphertext: string,
		aad: string,
		keyVersionId: string,
	): Promise<DecryptResult> {
		const response = await this.grpcCall("Decrypt", {
			tenant_id: orgId,
			scope_id: appId,
			ciphertext,
			aad,
			key_version_id: keyVersionId,
		});

		return {
			plaintext: Buffer.from(response.plaintext, "base64").toString("utf-8"),
		};
	}

	/**
	 * Batch encrypt multiple values in a single call.
	 */
	public async batchEncrypt(
		orgId: string,
		appId: string,
		items: BatchEncryptItem[],
	): Promise<EncryptResult[]> {
		const response = await this.grpcCall("BatchEncrypt", {
			tenant_id: orgId,
			scope_id: appId,
			items: items.map((item) => ({
				plaintext: Buffer.from(item.plaintext, "utf-8").toString("base64"),
				aad: item.aad,
			})),
		});

		return response.items.map((item: any) => ({
			ciphertext: item.ciphertext,
			keyVersionId: item.key_version_id,
		}));
	}

	/**
	 * Batch decrypt multiple values in a single call.
	 */
	public async batchDecrypt(
		orgId: string,
		appId: string,
		items: BatchDecryptItem[],
	): Promise<DecryptResult[]> {
		const response = await this.grpcCall("BatchDecrypt", {
			tenant_id: orgId,
			scope_id: appId,
			items: items.map((item) => ({
				ciphertext: item.ciphertext,
				aad: item.aad,
				key_version_id: item.keyVersionId,
			})),
		});

		return response.items.map((item: any) => ({
			plaintext: Buffer.from(item.plaintext, "base64").toString("utf-8"),
		}));
	}

	/**
	 * Internal gRPC call helper. Uses HTTP/2 JSON transcoding to communicate
	 * with miniKMS gRPC service.
	 *
	 * In production, this should use a proper gRPC client (@grpc/grpc-js).
	 * For the initial integration, we use HTTP/2 with JSON bodies as a simpler
	 * bridge that avoids proto code generation on the TS side.
	 */
	private async grpcCall(method: string, body: Record<string, any>): Promise<any> {
		const url = `http://${this.grpcAddr}/minikms.v1.KMSService/${method}`;

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`miniKMS ${method} failed (${response.status}): ${errorText}`);
			}

			return await response.json();
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(
					`KMS ${method} error: ${error.message}`,
					LogTypes.ERROR,
					"KMSClient",
				);
			}
			throw error;
		}
	}

	/**
	 * Health check for the miniKMS service.
	 */
	public async healthCheck(): Promise<boolean> {
		try {
			const url = `http://${this.grpcAddr}/grpc.health.v1.Health/Check`;
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ service: "minikms" }),
			});
			return response.ok;
		} catch {
			return false;
		}
	}
}

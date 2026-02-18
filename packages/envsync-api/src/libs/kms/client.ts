import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

import { config } from "@/utils/env";
import infoLogs, { LogTypes } from "@/libs/logger";

/**
 * KMS Client wrapping miniKMS gRPC Encrypt/Decrypt/BatchEncrypt/BatchDecrypt RPCs.
 * Singleton pattern matching VaultClient.
 *
 * Maps EnvSync concepts to generic miniKMS concepts:
 *   orgId  -> tenant_id
 *   appId  -> scope_id
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

// Proto file paths (resolved relative to this file)
const PROTO_DIR = path.resolve(import.meta.dir, "proto");
const KMS_PROTO_PATH = path.join(PROTO_DIR, "kms.proto");
const HEALTH_PROTO_PATH = path.join(PROTO_DIR, "health.proto");

const PROTO_LOADER_OPTIONS: protoLoader.Options = {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true,
};

export class KMSClient {
	private static instance: KMSClient | null = null;
	private grpcAddr: string;
	private kmsStub: grpc.Client;
	private healthStub: grpc.Client;

	private constructor() {
		this.grpcAddr = config.MINIKMS_GRPC_ADDR;
		const tlsEnabled = config.MINIKMS_TLS_ENABLED === "true";
		const tlsCaCert = config.MINIKMS_TLS_CA_CERT;

		const credentials = tlsEnabled
			? grpc.credentials.createSsl(
					tlsCaCert ? Buffer.from(tlsCaCert) : undefined,
				)
			: grpc.credentials.createInsecure();

		// Load KMS service proto
		const kmsPackageDef = protoLoader.loadSync(KMS_PROTO_PATH, PROTO_LOADER_OPTIONS);
		const kmsProto = grpc.loadPackageDefinition(kmsPackageDef);
		const KMSService = (kmsProto.minikms as any).v1.KMSService;
		this.kmsStub = new KMSService(this.grpcAddr, credentials);

		// Load gRPC health check proto
		const healthPackageDef = protoLoader.loadSync(HEALTH_PROTO_PATH, PROTO_LOADER_OPTIONS);
		const healthProto = grpc.loadPackageDefinition(healthPackageDef);
		const HealthService = (healthProto.grpc as any).health.v1.Health;
		this.healthStub = new HealthService(this.grpcAddr, credentials);
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
	 * Promisify a unary gRPC call on the given stub.
	 */
	private rpcCall<TRes>(
		stub: grpc.Client,
		method: string,
		request: Record<string, any>,
	): Promise<TRes> {
		return new Promise<TRes>((resolve, reject) => {
			(stub as any)[method](
				request,
				(err: grpc.ServiceError | null, response: TRes) => {
					if (err) reject(err);
					else resolve(response);
				},
			);
		});
	}

	/**
	 * Encrypt a single value via miniKMS.
	 * Maps orgId -> tenant_id, appId -> scope_id for the generic KMS interface.
	 */
	public async encrypt(
		orgId: string,
		appId: string,
		plaintext: string,
		aad: string,
	): Promise<EncryptResult> {
		try {
			const response = await this.rpcCall<any>(this.kmsStub, "Encrypt", {
				tenant_id: orgId,
				scope_id: appId,
				plaintext: Buffer.from(plaintext, "utf-8"),
				aad,
			});

			return {
				ciphertext: response.ciphertext,
				keyVersionId: response.key_version_id,
			};
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(
					`KMS Encrypt error: ${error.message}`,
					LogTypes.ERROR,
					"KMSClient",
				);
			}
			throw error;
		}
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
		try {
			const response = await this.rpcCall<any>(this.kmsStub, "Decrypt", {
				tenant_id: orgId,
				scope_id: appId,
				ciphertext,
				aad,
				key_version_id: keyVersionId,
			});

			return {
				plaintext: Buffer.from(response.plaintext).toString("utf-8"),
			};
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(
					`KMS Decrypt error: ${error.message}`,
					LogTypes.ERROR,
					"KMSClient",
				);
			}
			throw error;
		}
	}

	/**
	 * Batch encrypt multiple values in a single call.
	 */
	public async batchEncrypt(
		orgId: string,
		appId: string,
		items: BatchEncryptItem[],
	): Promise<EncryptResult[]> {
		try {
			const response = await this.rpcCall<any>(this.kmsStub, "BatchEncrypt", {
				tenant_id: orgId,
				scope_id: appId,
				items: items.map((item) => ({
					plaintext: Buffer.from(item.plaintext, "utf-8"),
					aad: item.aad,
				})),
			});

			return response.items.map((item: any) => ({
				ciphertext: item.ciphertext,
				keyVersionId: item.key_version_id,
			}));
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(
					`KMS BatchEncrypt error: ${error.message}`,
					LogTypes.ERROR,
					"KMSClient",
				);
			}
			throw error;
		}
	}

	/**
	 * Batch decrypt multiple values in a single call.
	 */
	public async batchDecrypt(
		orgId: string,
		appId: string,
		items: BatchDecryptItem[],
	): Promise<DecryptResult[]> {
		try {
			const response = await this.rpcCall<any>(this.kmsStub, "BatchDecrypt", {
				tenant_id: orgId,
				scope_id: appId,
				items: items.map((item) => ({
					ciphertext: item.ciphertext,
					aad: item.aad,
					key_version_id: item.keyVersionId,
				})),
			});

			return response.items.map((item: any) => ({
				plaintext: Buffer.from(item.plaintext).toString("utf-8"),
			}));
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(
					`KMS BatchDecrypt error: ${error.message}`,
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
			const response = await this.rpcCall<any>(this.healthStub, "Check", {
				service: "minikms",
			});
			return response.status === "SERVING";
		} catch {
			return false;
		}
	}
}

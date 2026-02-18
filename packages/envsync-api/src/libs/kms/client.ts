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

// PKI result interfaces
export interface CreateOrgCAResult {
	certPem: string;
	serialHex: string;
}

export interface IssueMemberCertResult {
	certPem: string;
	keyPem: string;
	serialHex: string;
}

export interface RevokeCertResult {
	success: boolean;
}

export interface GetCRLResult {
	crlDer: Buffer;
	crlNumber: number;
	isDelta: boolean;
}

export interface CheckOCSPResult {
	status: number; // 0=good, 1=revoked, 2=unknown
	revokedAt: string; // RFC3339, empty if not revoked
}

export interface GetRootCAResult {
	certPem: string;
}

// Proto file paths (resolved relative to this file)
const PROTO_DIR = path.resolve(import.meta.dir, "proto");
const KMS_PROTO_PATH = path.join(PROTO_DIR, "kms.proto");
const HEALTH_PROTO_PATH = path.join(PROTO_DIR, "health.proto");
const PKI_PROTO_PATH = path.join(PROTO_DIR, "pki.proto");

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
	private pkiStub: grpc.Client;

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

		// Load PKI service proto
		const pkiPackageDef = protoLoader.loadSync(PKI_PROTO_PATH, PROTO_LOADER_OPTIONS);
		const pkiProto = grpc.loadPackageDefinition(pkiPackageDef);
		const PKIService = (pkiProto.minikms as any).v1.PKIService;
		this.pkiStub = new PKIService(this.grpcAddr, credentials);
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

	// ─── PKI methods ──────────────────────────────────────────────────

	/**
	 * Create an Org Intermediate CA via miniKMS PKI.
	 */
	public async createOrgCA(orgId: string, orgName: string): Promise<CreateOrgCAResult> {
		try {
			const response = await this.rpcCall<any>(this.pkiStub, "CreateOrgCA", {
				org_id: orgId,
				org_name: orgName,
			});
			return {
				certPem: response.cert_pem,
				serialHex: response.serial_hex,
			};
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`PKI CreateOrgCA error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	/**
	 * Issue a member certificate via miniKMS PKI.
	 */
	public async issueMemberCert(
		memberId: string,
		memberEmail: string,
		orgId: string,
		role: string,
	): Promise<IssueMemberCertResult> {
		try {
			const response = await this.rpcCall<any>(this.pkiStub, "IssueMemberCert", {
				member_id: memberId,
				member_email: memberEmail,
				org_id: orgId,
				role,
			});
			return {
				certPem: response.cert_pem,
				keyPem: response.key_pem,
				serialHex: response.serial_hex,
			};
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`PKI IssueMemberCert error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	/**
	 * Revoke a certificate via miniKMS PKI.
	 */
	public async revokeCert(serialHex: string, orgId: string, reason: number): Promise<RevokeCertResult> {
		try {
			const response = await this.rpcCall<any>(this.pkiStub, "RevokeCert", {
				serial_hex: serialHex,
				org_id: orgId,
				reason,
			});
			return { success: response.success };
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`PKI RevokeCert error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	/**
	 * Get the CRL for an org via miniKMS PKI.
	 */
	public async getCRL(orgId: string, deltaOnly: boolean): Promise<GetCRLResult> {
		try {
			const response = await this.rpcCall<any>(this.pkiStub, "GetCRL", {
				org_id: orgId,
				delta_only: deltaOnly,
			});
			return {
				crlDer: Buffer.from(response.crl_der),
				crlNumber: Number(response.crl_number),
				isDelta: response.is_delta,
			};
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`PKI GetCRL error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	/**
	 * Check OCSP status for a certificate via miniKMS PKI.
	 */
	public async checkOCSP(serialHex: string, orgId: string): Promise<CheckOCSPResult> {
		try {
			const response = await this.rpcCall<any>(this.pkiStub, "CheckOCSP", {
				serial_hex: serialHex,
				org_id: orgId,
			});
			return {
				status: response.status,
				revokedAt: response.revoked_at || "",
			};
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`PKI CheckOCSP error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	/**
	 * Get the root CA certificate via miniKMS PKI.
	 */
	public async getRootCA(): Promise<GetRootCAResult> {
		try {
			const response = await this.rpcCall<any>(this.pkiStub, "GetRootCA", {});
			return { certPem: response.cert_pem };
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`PKI GetRootCA error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}
}

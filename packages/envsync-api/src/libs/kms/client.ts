import path from "node:path";
import { SpanKind } from "@opentelemetry/api";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

import { config } from "@/utils/env";
import infoLogs, { LogTypes } from "@/libs/logger";
import { withSpan } from "@/libs/telemetry";
import { externalServiceCalls } from "@/libs/telemetry/metrics";

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

// Vault service interfaces
export interface VaultWriteRequest {
	orgId: string;
	scopeId: string;
	entryType: string;
	key: string;
	envTypeId?: string;
	value: Buffer;
	createdBy: string;
}

export interface VaultWriteResult {
	id: string;
	version: number;
	keyVersionId: string;
}

export interface VaultReadRequest {
	orgId: string;
	scopeId: string;
	entryType: string;
	key: string;
	envTypeId?: string;
	clientSideDecrypt?: boolean;
}

export interface VaultReadResult {
	id: string;
	orgId: string;
	scopeId: string;
	entryType: string;
	key: string;
	envTypeId?: string;
	encryptedValue: Buffer;
	keyVersionId: string;
	version: number;
	createdAt: string;
	createdBy: string;
	// For BYOK client-side decrypt
	memberWrapEphemeralPub?: Buffer;
	memberWrappedOrgcaKey?: Buffer;
}

export interface VaultListEntry {
	key: string;
	latestVersion: number;
	createdAt: string;
	updatedAt: string;
}

export interface VaultVersionEntry {
	version: number;
	keyVersionId: string;
	createdAt: string;
	createdBy: string;
	deleted: boolean;
	destroyed: boolean;
}

// Session service interfaces
export interface CreateSessionManagedRequest {
	memberId: string;
	orgId: string;
	certSerial: string;
	scopes?: string[];
}

export interface CreateSessionResult {
	sessionToken: string;
	expiresAt: string;
	scopes: string[];
}

export interface ValidateSessionResult {
	valid: boolean;
	memberId: string;
	orgId: string;
	role: string;
	certSerial: string;
	scopes: string[];
	expiresAt: string;
}

// Proto file paths (resolved relative to this file)
const PROTO_DIR = path.resolve(import.meta.dir, "proto");
const KMS_PROTO_PATH = path.join(PROTO_DIR, "kms.proto");
const HEALTH_PROTO_PATH = path.join(PROTO_DIR, "health.proto");
const PKI_PROTO_PATH = path.join(PROTO_DIR, "pki.proto");
const VAULT_PROTO_PATH = path.join(PROTO_DIR, "vault.proto");
const SESSION_PROTO_PATH = path.join(PROTO_DIR, "session.proto");

const PROTO_LOADER_OPTIONS: protoLoader.Options = {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true,
};

/** Type for service constructor extracted from a loaded proto definition */
type GrpcServiceCtor = new (addr: string, creds: grpc.ChannelCredentials) => grpc.Client;

/** Helper to navigate nested proto package definitions by string keys */
interface NestedProto { [key: string]: NestedProto & GrpcServiceCtor }

// gRPC response shapes (wire format from proto stubs)
interface GrpcEncryptResponse { ciphertext: string; key_version_id: string }
interface GrpcDecryptResponse { plaintext: Buffer | string }
interface GrpcBatchEncryptResponse { items: Array<{ ciphertext: string; key_version_id: string }> }
interface GrpcBatchDecryptResponse { items: Array<{ plaintext: Buffer | string }> }
interface GrpcHealthResponse { status: string }
interface GrpcCreateOrgCAResponse { cert_pem: string; serial_hex: string }
interface GrpcIssueMemberCertResponse { cert_pem: string; key_pem: string; serial_hex: string }
interface GrpcRevokeCertResponse { success: boolean }
interface GrpcGetCRLResponse { crl_der: Buffer | string; crl_number: string | number; is_delta: boolean }
interface GrpcCheckOCSPResponse { status: number; revoked_at: string }
interface GrpcGetRootCAResponse { cert_pem: string }

// Vault gRPC response shapes
interface GrpcVaultWriteResponse { id: string; version: number; key_version_id: string }
interface GrpcVaultReadResponse {
	id: string; org_id: string; scope_id: string; entry_type: string;
	key: string; env_type_id: string; encrypted_value: Buffer;
	key_version_id: string; version: number; created_at: { seconds: string };
	created_by: string;
	member_wrap_ephemeral_pub: Buffer; member_wrapped_orgca_key: Buffer;
}
interface GrpcVaultDeleteResponse { success: boolean }
interface GrpcVaultDestroyResponse { success: boolean; destroyed_count: number }
interface GrpcVaultListResponse { entries: Array<{ key: string; latest_version: number; created_at: { seconds: string }; updated_at: { seconds: string } }> }
interface GrpcVaultHistoryResponse { versions: Array<{ version: number; key_version_id: string; created_at: { seconds: string }; created_by: string; deleted: boolean; destroyed: boolean }> }

// Session gRPC response shapes
interface GrpcCreateSessionResponse { session_token: string; expires_at: { seconds: string }; scopes: string[] }
interface GrpcValidateSessionResponse { valid: boolean; member_id: string; org_id: string; role: string; cert_serial: string; scopes: string[]; expires_at: { seconds: string } }
interface GrpcRevokeSessionResponse { success: boolean }
interface GrpcRevokeMemberSessionsResponse { revoked_count: number }

export class KMSClient {
	private static instance: Promise<KMSClient> | undefined;
	private grpcAddr: string;
	private kmsStub: grpc.Client;
	private healthStub: grpc.Client;
	private pkiStub: grpc.Client;
	private vaultStub: grpc.Client;
	private sessionStub: grpc.Client;

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
		const KMSService = (kmsProto as unknown as NestedProto).minikms.v1.KMSService;
		this.kmsStub = new KMSService(this.grpcAddr, credentials);

		// Load gRPC health check proto
		const healthPackageDef = protoLoader.loadSync(HEALTH_PROTO_PATH, PROTO_LOADER_OPTIONS);
		const healthProto = grpc.loadPackageDefinition(healthPackageDef);
		const HealthService = (healthProto as unknown as NestedProto).grpc.health.v1.Health;
		this.healthStub = new HealthService(this.grpcAddr, credentials);

		// Load PKI service proto
		const pkiPackageDef = protoLoader.loadSync(PKI_PROTO_PATH, PROTO_LOADER_OPTIONS);
		const pkiProto = grpc.loadPackageDefinition(pkiPackageDef);
		const PKIService = (pkiProto as unknown as NestedProto).minikms.v1.PKIService;
		this.pkiStub = new PKIService(this.grpcAddr, credentials);

		// Load Vault service proto
		const vaultPackageDef = protoLoader.loadSync(VAULT_PROTO_PATH, PROTO_LOADER_OPTIONS);
		const vaultProto = grpc.loadPackageDefinition(vaultPackageDef);
		const VaultService = (vaultProto as unknown as NestedProto).minikms.v1.VaultService;
		this.vaultStub = new VaultService(this.grpcAddr, credentials);

		// Load Session service proto
		const sessionPackageDef = protoLoader.loadSync(SESSION_PROTO_PATH, PROTO_LOADER_OPTIONS);
		const sessionProto = grpc.loadPackageDefinition(sessionPackageDef);
		const SessionService = (sessionProto as unknown as NestedProto).minikms.v1.SessionService;
		this.sessionStub = new SessionService(this.grpcAddr, credentials);
	}

	public static getInstance(): Promise<KMSClient> {
		this.instance ??= this._getInstance().catch(err => {
			this.instance = undefined;
			throw err;
		});
		return this.instance;
	}

	private static async _getInstance(): Promise<KMSClient> {
		const client = new KMSClient();
		infoLogs(
			`KMS client initialized, connecting to ${client.grpcAddr}`,
			LogTypes.LOGS,
			"KMSClient",
		);
		return client;
	}

	/**
	 * Promisify a unary gRPC call on the given stub, wrapped in an OTEL span.
	 */
	private rpcCall<TRes>(
		stub: grpc.Client,
		method: string,
		request: Record<string, unknown>,
	): Promise<TRes> {
		const serviceNameMap = new Map<grpc.Client, string>([
			[this.kmsStub, "minikms.v1.KMSService"],
			[this.pkiStub, "minikms.v1.PKIService"],
			[this.vaultStub, "minikms.v1.VaultService"],
			[this.sessionStub, "minikms.v1.SessionService"],
			[this.healthStub, "grpc.health.v1.Health"],
		]);
		const serviceName = serviceNameMap.get(stub) ?? "unknown";
		return withSpan(
			`grpc ${serviceName}/${method}`,
			{
				"rpc.system": "grpc",
				"rpc.service": serviceName,
				"rpc.method": method,
				"peer.service": "minikms",
			},
			async () => {
				externalServiceCalls.add(1, { "peer.service": "minikms", "rpc.method": method });
				return new Promise<TRes>((resolve, reject) => {
					const deadline = new Date(Date.now() + 10_000);
					(stub as unknown as Record<string, (req: Record<string, unknown>, opts: { deadline: Date }, cb: (err: grpc.ServiceError | null, res: TRes) => void) => void>)[method](
						request,
						{ deadline },
						(err: grpc.ServiceError | null, response: TRes) => {
							if (err) reject(err);
							else resolve(response);
						},
					);
				});
			},
			SpanKind.CLIENT,
		);
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
			const response = await this.rpcCall<GrpcEncryptResponse>(this.kmsStub, "Encrypt", {
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
			const response = await this.rpcCall<GrpcDecryptResponse>(this.kmsStub, "Decrypt", {
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
			const response = await this.rpcCall<GrpcBatchEncryptResponse>(this.kmsStub, "BatchEncrypt", {
				tenant_id: orgId,
				scope_id: appId,
				items: items.map((item) => ({
					plaintext: Buffer.from(item.plaintext, "utf-8"),
					aad: item.aad,
				})),
			});

			return response.items.map((item) => ({
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
			const response = await this.rpcCall<GrpcBatchDecryptResponse>(this.kmsStub, "BatchDecrypt", {
				tenant_id: orgId,
				scope_id: appId,
				items: items.map((item) => ({
					ciphertext: item.ciphertext,
					aad: item.aad,
					key_version_id: item.keyVersionId,
				})),
			});

			return response.items.map((item) => ({
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
			const response = await this.rpcCall<GrpcHealthResponse>(this.healthStub, "Check", {
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
			const response = await this.rpcCall<GrpcCreateOrgCAResponse>(this.pkiStub, "CreateOrgCA", {
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
			const response = await this.rpcCall<GrpcIssueMemberCertResponse>(this.pkiStub, "IssueMemberCert", {
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
			const response = await this.rpcCall<GrpcRevokeCertResponse>(this.pkiStub, "RevokeCert", {
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
			const response = await this.rpcCall<GrpcGetCRLResponse>(this.pkiStub, "GetCRL", {
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
			const response = await this.rpcCall<GrpcCheckOCSPResponse>(this.pkiStub, "CheckOCSP", {
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
			const response = await this.rpcCall<GrpcGetRootCAResponse>(this.pkiStub, "GetRootCA", {});
			return { certPem: response.cert_pem };
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`PKI GetRootCA error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	// ─── Vault service methods ──────────────────────────────────────

	/**
	 * Write a value to the vault. The value should be pre-encrypted with Layer 1 (RSA/Hybrid).
	 * miniKMS applies Layer 2 (ECIES) and Layer 3 (KMS envelope) internally.
	 */
	public async vaultWrite(
		req: VaultWriteRequest,
		sessionToken: string,
	): Promise<VaultWriteResult> {
		try {
			const response = await this.rpcCallWithAuth<GrpcVaultWriteResponse>(
				this.vaultStub,
				"Write",
				{
					org_id: req.orgId,
					scope_id: req.scopeId,
					entry_type: req.entryType,
					key: req.key,
					env_type_id: req.envTypeId || "",
					value: req.value,
					created_by: req.createdBy,
				},
				sessionToken,
			);
			return {
				id: response.id,
				version: response.version,
				keyVersionId: response.key_version_id,
			};
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`Vault Write error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	/**
	 * Read the latest version of a vault entry.
	 */
	public async vaultRead(
		req: VaultReadRequest,
		sessionToken: string,
	): Promise<VaultReadResult> {
		try {
			const response = await this.rpcCallWithAuth<GrpcVaultReadResponse>(
				this.vaultStub,
				"Read",
				{
					org_id: req.orgId,
					scope_id: req.scopeId,
					entry_type: req.entryType,
					key: req.key,
					env_type_id: req.envTypeId || "",
					client_side_decrypt: req.clientSideDecrypt ?? false,
				},
				sessionToken,
			);
			return this.mapVaultReadResponse(response);
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`Vault Read error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	/**
	 * Soft-delete a vault entry.
	 */
	public async vaultDelete(
		orgId: string,
		scopeId: string,
		entryType: string,
		key: string,
		envTypeId: string | undefined,
		sessionToken: string,
	): Promise<boolean> {
		try {
			const response = await this.rpcCallWithAuth<GrpcVaultDeleteResponse>(
				this.vaultStub,
				"Delete",
				{ org_id: orgId, scope_id: scopeId, entry_type: entryType, key, env_type_id: envTypeId || "" },
				sessionToken,
			);
			return response.success;
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`Vault Delete error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	/**
	 * Permanently destroy a vault entry.
	 */
	public async vaultDestroy(
		orgId: string,
		scopeId: string,
		entryType: string,
		key: string,
		envTypeId: string | undefined,
		version: number,
		sessionToken: string,
	): Promise<number> {
		try {
			const response = await this.rpcCallWithAuth<GrpcVaultDestroyResponse>(
				this.vaultStub,
				"Destroy",
				{ org_id: orgId, scope_id: scopeId, entry_type: entryType, key, env_type_id: envTypeId || "", version },
				sessionToken,
			);
			return response.destroyed_count;
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`Vault Destroy error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	/**
	 * List active keys in a vault scope.
	 */
	public async vaultList(
		orgId: string,
		scopeId: string,
		entryType: string,
		envTypeId: string | undefined,
		sessionToken: string,
	): Promise<VaultListEntry[]> {
		try {
			const response = await this.rpcCallWithAuth<GrpcVaultListResponse>(
				this.vaultStub,
				"List",
				{ org_id: orgId, scope_id: scopeId, entry_type: entryType, env_type_id: envTypeId || "" },
				sessionToken,
			);
			return (response.entries || []).map((e) => ({
				key: e.key,
				latestVersion: e.latest_version,
				createdAt: e.created_at?.seconds || "",
				updatedAt: e.updated_at?.seconds || "",
			}));
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`Vault List error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	/**
	 * Get version history for a vault entry.
	 */
	public async vaultHistory(
		orgId: string,
		scopeId: string,
		entryType: string,
		key: string,
		envTypeId: string | undefined,
		sessionToken: string,
	): Promise<VaultVersionEntry[]> {
		try {
			const response = await this.rpcCallWithAuth<GrpcVaultHistoryResponse>(
				this.vaultStub,
				"History",
				{ org_id: orgId, scope_id: scopeId, entry_type: entryType, key, env_type_id: envTypeId || "" },
				sessionToken,
			);
			return (response.versions || []).map((v) => ({
				version: v.version,
				keyVersionId: v.key_version_id,
				createdAt: v.created_at?.seconds || "",
				createdBy: v.created_by,
				deleted: v.deleted,
				destroyed: v.destroyed,
			}));
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`Vault History error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	// ─── Session service methods ──────────────────────────────────────

	/**
	 * Create a managed session (for web/OIDC-authenticated members).
	 */
	public async createSessionManaged(req: CreateSessionManagedRequest): Promise<CreateSessionResult> {
		try {
			const response = await this.rpcCall<GrpcCreateSessionResponse>(this.sessionStub, "CreateSession", {
				managed_auth: {
					member_id: req.memberId,
					org_id: req.orgId,
					cert_serial: req.certSerial,
				},
				scopes: req.scopes || [],
			});
			return {
				sessionToken: response.session_token,
				expiresAt: response.expires_at?.seconds || "",
				scopes: response.scopes,
			};
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`Session CreateSession error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	/**
	 * Validate a session token.
	 */
	public async validateSession(sessionToken: string): Promise<ValidateSessionResult> {
		try {
			const response = await this.rpcCall<GrpcValidateSessionResponse>(this.sessionStub, "ValidateSession", {
				session_token: sessionToken,
			});
			return {
				valid: response.valid,
				memberId: response.member_id,
				orgId: response.org_id,
				role: response.role,
				certSerial: response.cert_serial,
				scopes: response.scopes,
				expiresAt: response.expires_at?.seconds || "",
			};
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`Session ValidateSession error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	/**
	 * Revoke a session token.
	 */
	public async revokeSession(sessionToken: string): Promise<boolean> {
		try {
			const response = await this.rpcCall<GrpcRevokeSessionResponse>(this.sessionStub, "RevokeSession", {
				session_token: sessionToken,
			});
			return response.success;
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`Session RevokeSession error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	/**
	 * Revoke all sessions for a member.
	 */
	public async revokeMemberSessions(memberId: string, orgId: string): Promise<number> {
		try {
			const response = await this.rpcCall<GrpcRevokeMemberSessionsResponse>(this.sessionStub, "RevokeMemberSessions", {
				member_id: memberId,
				org_id: orgId,
			});
			return response.revoked_count;
		} catch (error) {
			if (error instanceof Error) {
				infoLogs(`Session RevokeMemberSessions error: ${error.message}`, LogTypes.ERROR, "KMSClient");
			}
			throw error;
		}
	}

	// ─── Private helpers ──────────────────────────────────────

	/**
	 * Promisify a unary gRPC call with a session token in metadata.
	 */
	private rpcCallWithAuth<TRes>(
		stub: grpc.Client,
		method: string,
		request: Record<string, unknown>,
		sessionToken: string,
	): Promise<TRes> {
		const serviceNameMap = new Map<grpc.Client, string>([
			[this.kmsStub, "minikms.v1.KMSService"],
			[this.pkiStub, "minikms.v1.PKIService"],
			[this.vaultStub, "minikms.v1.VaultService"],
			[this.sessionStub, "minikms.v1.SessionService"],
			[this.healthStub, "grpc.health.v1.Health"],
		]);
		const serviceName = serviceNameMap.get(stub) ?? "unknown";
		return withSpan(
			`grpc ${serviceName}/${method}`,
			{
				"rpc.system": "grpc",
				"rpc.service": serviceName,
				"rpc.method": method,
				"peer.service": "minikms",
			},
			async () => {
				externalServiceCalls.add(1, { "peer.service": "minikms", "rpc.method": method });
				return new Promise<TRes>((resolve, reject) => {
					const deadline = new Date(Date.now() + 10_000);
					const metadata = new grpc.Metadata();
					metadata.set("authorization", `Bearer ${sessionToken}`);
					(stub as unknown as Record<string, (req: Record<string, unknown>, md: grpc.Metadata, opts: { deadline: Date }, cb: (err: grpc.ServiceError | null, res: TRes) => void) => void>)[method](
						request,
						metadata,
						{ deadline },
						(err: grpc.ServiceError | null, response: TRes) => {
							if (err) reject(err);
							else resolve(response);
						},
					);
				});
			},
			SpanKind.CLIENT,
		);
	}

	private mapVaultReadResponse(response: GrpcVaultReadResponse): VaultReadResult {
		return {
			id: response.id,
			orgId: response.org_id,
			scopeId: response.scope_id,
			entryType: response.entry_type,
			key: response.key,
			envTypeId: response.env_type_id || undefined,
			encryptedValue: Buffer.from(response.encrypted_value),
			keyVersionId: response.key_version_id,
			version: response.version,
			createdAt: response.created_at?.seconds || "",
			createdBy: response.created_by,
			memberWrapEphemeralPub: response.member_wrap_ephemeral_pub?.length
				? Buffer.from(response.member_wrap_ephemeral_pub) : undefined,
			memberWrappedOrgcaKey: response.member_wrapped_orgca_key?.length
				? Buffer.from(response.member_wrapped_orgca_key) : undefined,
		};
	}
}

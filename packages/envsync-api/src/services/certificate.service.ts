import { v4 as uuidv4 } from "uuid";

import { JsonValue, DB } from "@/libs/db";
import { BusinessRuleError, ConflictError, NotFoundError } from "@/libs/errors";
import { invalidateCache } from "@/helpers/cache";
import { CacheKeys } from "@/helpers/cache-keys";
import { kmsDecrypt } from "@/helpers/key-store";
import { runSaga } from "@/helpers/saga";
import { KMSClient } from "@/libs/kms/client";
import { invalidateSessionToken } from "@/libs/kms/session-manager";
import { AuthorizationService } from "@/services/authorization.service";
import { AppService } from "@/services/app.service";
import { PlanLimitService } from "@/services/plan_limit.service";

const OCSP_STATUS_MAP: Record<number, string> = {
	0: "good",
	1: "revoked",
	2: "unknown",
};

function derToPem(der: Buffer, label: string): string {
	const b64 = der.toString("base64");
	const lines: string[] = [];
	for (let i = 0; i < b64.length; i += 64) {
		lines.push(b64.slice(i, i + 64));
	}
	return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

function normalizeMetadata(metadata?: Record<string, string>) {
	return metadata ? new JsonValue(metadata) : new JsonValue<Record<string, string>>({});
}

function systemKeyAAD(certId: string) {
	return `certificate:${certId}:system-key`;
}

interface IssueMemberCertParams {
	org_id: string;
	target_user_id: string;
	target_email: string;
	issued_by_user_id: string;
	envsync_pki_role: "master" | "member";
	is_system_generated: boolean;
	persist_private_key: boolean;
	description?: string;
	metadata?: Record<string, string>;
}

export class CertificateService {
	private static async getActiveOrgCARecord(org_id: string) {
		const db = await DB.getInstance();
		return db
			.selectFrom("org_certificates")
			.selectAll()
			.where("org_id", "=", org_id)
			.where("cert_type", "=", "org_ca")
			.where("status", "=", "active")
			.orderBy("created_at", "desc")
			.executeTakeFirst();
	}

	private static async getCertificateBySerial(org_id: string, serial_hex: string) {
		const db = await DB.getInstance();
		return db
			.selectFrom("org_certificates")
			.selectAll()
			.where("org_id", "=", org_id)
			.where("serial_hex", "=", serial_hex)
			.executeTakeFirst();
	}

	private static async encryptPrivateKeyForSystemCert(org_id: string, cert_id: string, key_pem: string) {
		const kms = await KMSClient.getInstance();
		const result = await kms.encrypt(org_id, cert_id, key_pem, systemKeyAAD(cert_id));
		return `KMS:v1:${result.keyVersionId}:${result.ciphertext}`;
	}

	private static async decryptSystemPrivateKey(cert: {
		id: string;
		org_id: string;
		encrypted_key_pem?: string | null;
	}) {
		if (!cert.encrypted_key_pem) {
			throw new NotFoundError("Certificate private key", cert.id);
		}

		return kmsDecrypt(cert.org_id, cert.id, cert.encrypted_key_pem, systemKeyAAD(cert.id));
	}

	private static ensureMutableCertificate(cert: { id: string; is_system_generated: boolean }) {
		if (cert.is_system_generated) {
			throw new BusinessRuleError(
				"System-generated certificates cannot be modified through this API.",
				403,
				"SYSTEM_CERTIFICATE_IMMUTABLE",
			);
		}
	}

	public static initOrgCA = async (
		org_id: string,
		org_name: string,
		user_id: string,
		description?: string,
		metadata?: Record<string, string>,
		options?: { is_system_generated?: boolean },
	) => {
		const db = await DB.getInstance();
		const existing = await this.getActiveOrgCARecord(org_id);
		if (existing) {
			throw new ConflictError("Organization CA already initialized");
		}

		const certId = uuidv4();
		let certPem = "";
		let serialHex = "";

		await runSaga("initOrgCA", {}, [
			{
				name: "kms-create-ca",
				execute: async () => {
					const kms = await KMSClient.getInstance();
					const result = await kms.createOrgCA(org_id, org_name);
					certPem = result.certPem;
					serialHex = result.serialHex;
				},
			},
			{
				name: "db-insert",
				execute: async () => {
					const now = new Date();
					await db
						.insertInto("org_certificates")
						.values({
							id: certId,
							org_id,
							user_id,
							serial_hex: serialHex,
							cert_type: "org_ca",
							subject_cn: `${org_name} CA`,
							status: "active",
							cert_pem: certPem,
							description: description || null,
							metadata: normalizeMetadata(metadata),
							is_system_generated: options?.is_system_generated ?? false,
							supersedes_certificate_id: null,
							created_at: now,
							updated_at: now,
						})
						.executeTakeFirstOrThrow();
				},
				compensate: async () => {
					await db.deleteFrom("org_certificates").where("id", "=", certId).execute();
				},
			},
			{
				name: "fga-write",
				execute: async () => {
					await AuthorizationService.writeCertificateRelations(certId, org_id, user_id);
				},
				compensate: async () => {
					await AuthorizationService.deleteResourceTuples("certificate", certId);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.certsByOrg(org_id));
					invalidateSessionToken(user_id, org_id);
				},
			},
		]);

		return this.getCertificate(certId, { include_system_generated: true });
	};

	public static issueMemberCert = async ({
		org_id,
		target_user_id,
		target_email,
		issued_by_user_id,
		envsync_pki_role,
		is_system_generated,
		persist_private_key,
		description,
		metadata,
	}: IssueMemberCertParams) => {
		const orgCA = await this.getActiveOrgCARecord(org_id);
		if (!orgCA) {
			throw new BusinessRuleError(
				"Organization CA not initialized. Initialize CA first.",
				409,
				"ORG_CA_REQUIRED_FOR_SYSTEM_CERT",
			);
		}

		const db = await DB.getInstance();
		const certId = uuidv4();
		let memberCertPem = "";
		let memberKeyPem = "";
		let memberSerialHex = "";
		let encryptedKeyPem: string | null = null;

		const certificateMetadata = {
			issued_by_user_id,
			issued_source: is_system_generated ? "auth_repair" : "manual_issue",
			envsync_pki_role,
			...(metadata || {}),
		};

		await runSaga("issueMemberCert", {}, [
			{
				name: "kms-issue-cert",
				execute: async () => {
					const kms = await KMSClient.getInstance();
					const result = await kms.issueMemberCert(
						target_user_id,
						target_email,
						org_id,
						envsync_pki_role,
					);
					memberCertPem = result.certPem;
					memberKeyPem = result.keyPem;
					memberSerialHex = result.serialHex;
				},
			},
			{
				name: "kms-encrypt-private-key",
				execute: async () => {
					if (is_system_generated && persist_private_key) {
						encryptedKeyPem = await this.encryptPrivateKeyForSystemCert(
							org_id,
							certId,
							memberKeyPem,
						);
					}
				},
			},
			{
				name: "db-insert",
				execute: async () => {
					const now = new Date();
					await db
						.insertInto("org_certificates")
						.values({
							id: certId,
							org_id,
							user_id: target_user_id,
							serial_hex: memberSerialHex,
							cert_type: "member",
							subject_cn: target_email,
							subject_email: target_email,
							status: "active",
							cert_pem: memberCertPem,
							description: description || null,
							metadata: normalizeMetadata(certificateMetadata),
							is_system_generated,
							encrypted_key_pem: encryptedKeyPem,
							supersedes_certificate_id: null,
							created_at: now,
							updated_at: now,
						})
						.executeTakeFirstOrThrow();
				},
				compensate: async () => {
					await db.deleteFrom("org_certificates").where("id", "=", certId).execute();
				},
			},
			{
				name: "fga-write",
				execute: async () => {
					await AuthorizationService.writeCertificateRelations(certId, org_id, target_user_id);
				},
				compensate: async () => {
					await AuthorizationService.deleteResourceTuples("certificate", certId);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.certsByOrg(org_id));
					invalidateSessionToken(target_user_id, org_id);
				},
			},
		]);

		const cert = await this.getCertificate(certId, { include_system_generated: true });
		return {
			...cert,
			key_pem: memberKeyPem,
		};
	};

	public static issueLeaf = async ({
		org_id,
		app_id,
		env_type_id,
		issued_by_user_id,
		common_name,
		sans = [],
		ttl_days = 90,
		key_algorithm = "ECDSA_P256",
		description,
	}: {
		org_id: string;
		app_id: string;
		env_type_id?: string;
		issued_by_user_id: string;
		common_name: string;
		sans?: string[];
		ttl_days?: number;
		key_algorithm?: string;
		description?: string;
	}) => {
		await PlanLimitService.assertFeature(org_id, "certificates");
		const orgCA = await this.getActiveOrgCARecord(org_id);
		if (!orgCA) {
			throw new BusinessRuleError("Organization CA not initialized. Initialize CA first.", 409, "ORG_CA_REQUIRED");
		}
		const app = await AppService.getApp({ id: app_id });
		if (app.org_id !== org_id) {
			throw new NotFoundError("App", app_id);
		}

		const dnsSans = [...new Set([common_name, ...sans].map(value => value.trim()).filter(Boolean))];
		const db = await DB.getInstance();
		const certId = uuidv4();
		let certPem = "";
		let keyPem = "";
		let serialHex = "";
		const now = new Date();
		const notAfter = new Date(now.getTime() + ttl_days * 24 * 60 * 60 * 1000);

		await runSaga("issueLeafCert", {}, [
			{
				name: "kms-issue-leaf",
				execute: async () => {
					const kms = await KMSClient.getInstance();
					const result = await kms.issueLeafCert({
						orgId: org_id,
						commonName: common_name,
						dnsSans,
						ttlDays: ttl_days,
						keyAlgorithm: key_algorithm,
					});
					certPem = result.certPem;
					keyPem = result.keyPem;
					serialHex = result.serialHex;
				},
			},
			{
				name: "db-insert",
				execute: async () => {
					await db
						.insertInto("org_certificates")
						.values({
							id: certId,
							org_id,
							user_id: issued_by_user_id,
							serial_hex: serialHex,
							cert_type: "leaf",
							subject_cn: common_name,
							subject_email: null,
							status: "active",
							cert_pem: certPem,
							description: description || null,
							metadata: normalizeMetadata({ issued_by_user_id, issued_source: "leaf" }),
							is_system_generated: false,
							encrypted_key_pem: null,
							supersedes_certificate_id: null,
							app_id,
							env_type_id: env_type_id || null,
							sans: dnsSans,
							not_before: now,
							not_after: notAfter,
							created_at: now,
							updated_at: now,
						})
						.executeTakeFirstOrThrow();
				},
				compensate: async () => {
					await db.deleteFrom("org_certificates").where("id", "=", certId).execute();
				},
			},
			{
				name: "fga-write",
				execute: async () => {
					await AuthorizationService.writeCertificateRelations(certId, org_id, issued_by_user_id);
				},
				compensate: async () => {
					await AuthorizationService.deleteResourceTuples("certificate", certId);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.certsByOrg(org_id));
				},
			},
		]);

		const cert = await this.getCertificate(certId);
		return { ...cert, key_pem: keyPem };
	};

	public static signCsr = async ({
		org_id,
		app_id,
		issued_by_user_id,
		csr_pem,
		ttl_days = 90,
		description,
	}: {
		org_id: string;
		app_id?: string;
		issued_by_user_id: string;
		csr_pem: string;
		ttl_days?: number;
		description?: string;
	}) => {
		await PlanLimitService.assertFeature(org_id, "certificates");
		const orgCA = await this.getActiveOrgCARecord(org_id);
		if (!orgCA) {
			throw new BusinessRuleError("Organization CA not initialized. Initialize CA first.", 409, "ORG_CA_REQUIRED");
		}
		if (app_id) {
			const app = await AppService.getApp({ id: app_id });
			if (app.org_id !== org_id) {
				throw new NotFoundError("App", app_id);
			}
		}

		const db = await DB.getInstance();
		const certId = uuidv4();
		let certPem = "";
		let serialHex = "";
		const now = new Date();
		const notAfter = new Date(now.getTime() + ttl_days * 24 * 60 * 60 * 1000);
		const cnMatch = csr_pem.match(/CN\s*=\s*([^,\n/]+)/i);
		const subjectCn = cnMatch?.[1]?.trim() || "csr";

		await runSaga("signCsr", {}, [
			{
				name: "kms-sign-csr",
				execute: async () => {
					const kms = await KMSClient.getInstance();
					const result = await kms.signCsr({
						orgId: org_id,
						csrPem: csr_pem,
						ttlDays: ttl_days,
					});
					certPem = result.certPem;
					serialHex = result.serialHex;
				},
			},
			{
				name: "db-insert",
				execute: async () => {
					await db
						.insertInto("org_certificates")
						.values({
							id: certId,
							org_id,
							user_id: issued_by_user_id,
							serial_hex: serialHex,
							cert_type: "leaf",
							subject_cn: subjectCn,
							subject_email: null,
							status: "active",
							cert_pem: certPem,
							description: description || null,
							metadata: normalizeMetadata({ issued_by_user_id, issued_source: "csr" }),
							is_system_generated: false,
							encrypted_key_pem: null,
							supersedes_certificate_id: null,
							app_id: app_id || null,
							env_type_id: null,
							sans: [],
							not_before: now,
							not_after: notAfter,
							created_at: now,
							updated_at: now,
						})
						.executeTakeFirstOrThrow();
				},
				compensate: async () => {
					await db.deleteFrom("org_certificates").where("id", "=", certId).execute();
				},
			},
			{
				name: "fga-write",
				execute: async () => {
					await AuthorizationService.writeCertificateRelations(certId, org_id, issued_by_user_id);
				},
				compensate: async () => {
					await AuthorizationService.deleteResourceTuples("certificate", certId);
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.certsByOrg(org_id));
				},
			},
		]);

		return this.getCertificate(certId);
	};

	public static listCertificates = async (
		org_id: string,
		page = 1,
		per_page = 50,
		include_system_generated = false,
	) => {
		const db = await DB.getInstance();
		let query = db
			.selectFrom("org_certificates")
			.selectAll()
			.where("org_id", "=", org_id)
			.orderBy("created_at", "desc")
			.limit(per_page)
			.offset((page - 1) * per_page);

		if (!include_system_generated) {
			query = query.where("is_system_generated", "=", false);
		}

		return query.execute();
	};

	public static getCertificate = async (
		id: string,
		options?: { include_system_generated?: boolean },
	) => {
		const db = await DB.getInstance();
		const cert = await db
			.selectFrom("org_certificates")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		if (!cert || (cert.is_system_generated && !options?.include_system_generated)) {
			throw new NotFoundError("Certificate", id);
		}

		return cert;
	};

	public static getOrgCA = async (org_id: string) => this.getActiveOrgCARecord(org_id);

	public static getLatestActiveSystemMemberCert = async (org_id: string, user_id: string) => {
		const db = await DB.getInstance();
		return db
			.selectFrom("org_certificates")
			.selectAll()
			.where("org_id", "=", org_id)
			.where("user_id", "=", user_id)
			.where("cert_type", "=", "member")
			.where("status", "=", "active")
			.where("is_system_generated", "=", true)
			.orderBy("created_at", "desc")
			.executeTakeFirst();
	};

	public static getLatestActiveManualMemberCert = async (org_id: string, user_id: string) => {
		const db = await DB.getInstance();
		return db
			.selectFrom("org_certificates")
			.selectAll()
			.where("org_id", "=", org_id)
			.where("user_id", "=", user_id)
			.where("cert_type", "=", "member")
			.where("status", "=", "active")
			.where("is_system_generated", "=", false)
			.orderBy("created_at", "desc")
			.executeTakeFirst();
	};

	public static getMyCertificateBundle = async (org_id: string, user_id: string) => {
		const cert = await this.getLatestActiveSystemMemberCert(org_id, user_id);
		if (!cert) {
			throw new NotFoundError("Certificate bundle", user_id, "NOT_FOUND");
		}

		const [rootCA, key_pem] = await Promise.all([
			this.getRootCA(),
			this.decryptSystemPrivateKey(cert),
		]);

		return {
			root_ca_pem: rootCA.cert_pem,
			member_certificate: {
				...cert,
				key_pem,
			},
		};
	};

	public static revokeCert = async (serial_hex: string, org_id: string, reason: number) => {
		const cert = await this.getCertificateBySerial(org_id, serial_hex);
		if (!cert) {
			throw new NotFoundError("Certificate", serial_hex);
		}
		this.ensureMutableCertificate(cert);

		const kms = await KMSClient.getInstance();
		await kms.revokeCert(serial_hex, org_id, reason);

		const db = await DB.getInstance();
		const now = new Date();

		await db
			.updateTable("org_certificates")
			.set({
				status: "revoked",
				revoked_at: now,
				revocation_reason: reason,
				updated_at: now,
			})
			.where("serial_hex", "=", serial_hex)
			.where("org_id", "=", org_id)
			.execute();

		await invalidateCache(CacheKeys.certsByOrg(org_id));
		invalidateSessionToken(cert.user_id, org_id);

		return {
			serial_hex,
			status: "revoked",
		};
	};

	public static getCRL = async (org_id: string, deltaOnly: boolean) => {
		const kms = await KMSClient.getInstance();
		const result = await kms.getCRL(org_id, deltaOnly);

		return {
			crl_pem: derToPem(result.crlDer, "X509 CRL"),
			crl_number: result.crlNumber,
			is_delta: result.isDelta,
		};
	};

	public static checkOCSP = async (serialHex: string, org_id: string) => {
		const kms = await KMSClient.getInstance();
		const result = await kms.checkOCSP(serialHex, org_id);

		return {
			status: OCSP_STATUS_MAP[result.status] || "unknown",
			revoked_at: result.revokedAt || null,
		};
	};

	public static getRootCA = async () => {
		const kms = await KMSClient.getInstance();
		const result = await kms.getRootCA();
		return { cert_pem: result.certPem };
	};

	public static renewCert = async ({
		id,
		org_id,
		user_id,
		revoke_previous,
		reason,
		description,
	}: {
		id: string;
		org_id: string;
		user_id: string;
		revoke_previous: boolean;
		reason: number;
		description?: string;
	}) => {
		const cert = await this.getCertificate(id, { include_system_generated: true });
		if (cert.org_id !== org_id) {
			throw new NotFoundError("Certificate", id);
		}
		this.ensureMutableCertificate(cert);
		if (cert.cert_type !== "member" || !cert.subject_email) {
			throw new BusinessRuleError("Only member certificates can be renewed.");
		}

		const priorMetadata = (cert.metadata as Record<string, string> | undefined) ?? {};
		const renewed = await this.issueMemberCert({
			org_id,
			target_user_id: cert.user_id,
			target_email: cert.subject_email,
			issued_by_user_id: user_id,
			envsync_pki_role:
				priorMetadata.envsync_pki_role === "master" ? "master" : "member",
			is_system_generated: false,
			persist_private_key: false,
			description: description || cert.description || undefined,
			metadata: {
				...priorMetadata,
				issued_source: "manual_issue",
			},
		});

		const db = await DB.getInstance();
		await db
			.updateTable("org_certificates")
			.set({
				supersedes_certificate_id: cert.id,
				updated_at: new Date(),
			})
			.where("id", "=", renewed.id)
			.execute();

		if (revoke_previous) {
			await this.revokeCert(cert.serial_hex, org_id, reason);
			await db
				.updateTable("org_certificates")
				.set({
					status: "superseded",
					updated_at: new Date(),
				})
				.where("id", "=", cert.id)
				.execute();
		}

		return {
			...renewed,
			supersedes_certificate_id: cert.id,
		};
	};
}

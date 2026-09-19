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
import { AuditLogService } from "@/services/audit_log.service";
import { ChangeRequestService } from "@/services/change_request.service";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { EnvTypeService } from "@/services/env_type.service";
import { PlanLimitService } from "@/services/plan_limit.service";
import { SecretService } from "@/services/secret.service";

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
							auto_renew: false,
							renew_days_before: 30,
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
							auto_renew: false,
							renew_days_before: 30,
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
							auto_renew: false,
							renew_days_before: 30,
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
							auto_renew: false,
							renew_days_before: 30,
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

	public static getChain = async (org_id: string) => {
		const [orgCA, rootCA, imported] = await Promise.all([
			this.getActiveOrgCARecord(org_id),
			this.getRootCA(),
			(async () => {
				const db = await DB.getInstance();
				return db
					.selectFrom("org_certificates")
					.selectAll()
					.where("org_id", "=", org_id)
					.where("cert_type", "=", "imported_chain")
					.where("status", "=", "active")
					.orderBy("created_at", "desc")
					.execute();
			})(),
		]);
		const pems = [
			...imported.map(row => row.cert_pem).filter(Boolean),
			orgCA?.cert_pem,
			rootCA.cert_pem,
		].filter((value): value is string => Boolean(value));
		return {
			chain_pem: pems.join("\n"),
			org_ca_pem: orgCA?.cert_pem ?? null,
			root_ca_pem: rootCA.cert_pem,
			imported_count: imported.length,
		};
	};

	public static importChain = async ({
		org_id,
		user_id,
		chain_pem,
		env_type_id,
		description,
	}: {
		org_id: string;
		user_id: string;
		chain_pem: string;
		env_type_id?: string;
		description?: string;
	}) => {
		if (!EditionPolicyService.isEnterprise()) {
			throw new BusinessRuleError("CA chain import requires the Enterprise edition.", 403, "ENTERPRISE_REQUIRED");
		}
		await PlanLimitService.assertFeature(org_id, "certificates");
		if (!/BEGIN CERTIFICATE/.test(chain_pem)) {
			throw new BusinessRuleError("chain_pem must contain at least one PEM certificate.");
		}
		const orgCA = await this.getActiveOrgCARecord(org_id);
		if (!orgCA) {
			throw new BusinessRuleError("Organization CA not initialized. Initialize CA first.", 409, "ORG_CA_REQUIRED");
		}
		if (env_type_id) {
			const envType = await EnvTypeService.getEnvType(env_type_id);
			if (envType.org_id !== org_id) {
				throw new NotFoundError("EnvType", env_type_id);
			}
		}
		const db = await DB.getInstance();
		const now = new Date();
		const certId = uuidv4();
		await db
			.insertInto("org_certificates")
			.values({
				id: certId,
				org_id,
				user_id,
				serial_hex: `import-${certId.replace(/-/g, "").slice(0, 16)}`,
				cert_type: "imported_chain",
				subject_cn: description || "Imported CA chain",
				status: "active",
				cert_pem: chain_pem,
				description: description || null,
				metadata: normalizeMetadata({ imported_by: user_id }),
				is_system_generated: false,
				app_id: null,
				env_type_id: env_type_id || null,
				sans: [],
				auto_renew: false,
				renew_days_before: 30,
				created_at: now,
				updated_at: now,
			})
			.execute();
		await invalidateCache(CacheKeys.certsByOrg(org_id));
		return this.getCertificate(certId);
	};

	public static labelEnvCa = async ({
		org_id,
		user_id,
		env_type_id,
		name,
	}: {
		org_id: string;
		user_id: string;
		env_type_id: string;
		name?: string;
	}) => {
		if (!EditionPolicyService.isEnterprise()) {
			throw new BusinessRuleError("Environment CAs require the Enterprise edition.", 403, "ENTERPRISE_REQUIRED");
		}
		await PlanLimitService.assertFeature(org_id, "certificates");
		const orgCA = await this.getActiveOrgCARecord(org_id);
		if (!orgCA || !orgCA.cert_pem) {
			throw new BusinessRuleError("Organization CA not initialized. Initialize CA first.", 409, "ORG_CA_REQUIRED");
		}
		const envType = await EnvTypeService.getEnvType(env_type_id);
		if (envType.org_id !== org_id) {
			throw new NotFoundError("EnvType", env_type_id);
		}
		const db = await DB.getInstance();
		const existing = await db
			.selectFrom("org_certificates")
			.select("id")
			.where("org_id", "=", org_id)
			.where("cert_type", "=", "org_ca")
			.where("env_type_id", "=", env_type_id)
			.where("status", "=", "active")
			.executeTakeFirst();
		if (existing) {
			throw new ConflictError("Environment CA already exists for this environment");
		}
		const certId = uuidv4();
		const now = new Date();
		await db
			.insertInto("org_certificates")
			.values({
				id: certId,
				org_id,
				user_id,
				serial_hex: `envca-${certId.replace(/-/g, "").slice(0, 16)}`,
				cert_type: "org_ca",
				subject_cn: name || `${envType.name} CA`,
				status: "active",
				cert_pem: orgCA.cert_pem,
				description: "Environment-scoped CA label; leaves are still signed by the organization intermediate.",
				metadata: normalizeMetadata({ env_ca: "true", parent_org_ca: orgCA.id }),
				is_system_generated: false,
				env_type_id,
				sans: [],
				auto_renew: false,
				renew_days_before: 30,
				created_at: now,
				updated_at: now,
			})
			.execute();
		await invalidateCache(CacheKeys.certsByOrg(org_id));
		return this.getCertificate(certId);
	};

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

	/** Mark expired certs and fire expiring webhooks (once per calendar day). */
	public static processLifecycle = async (now = new Date()) => {
		const db = await DB.getInstance();
		const expiringBefore = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
		const today = now.toISOString().slice(0, 10);

		const due = await db
			.selectFrom("org_certificates")
			.selectAll()
			.where("status", "=", "active")
			.where("not_after", "is not", null)
			.where("not_after", "<=", expiringBefore)
			.execute();

		let expired = 0;
		let expiring = 0;

		for (const cert of due) {
			if (!cert.not_after) {
				continue;
			}
			const notAfter = new Date(cert.not_after);
			if (notAfter.getTime() <= now.getTime()) {
				await db
					.updateTable("org_certificates")
					.set({ status: "expired", updated_at: now })
					.where("id", "=", cert.id)
					.where("status", "=", "active")
					.execute();
				await AuditLogService.notifyAuditSystem({
					action: "cert_expired",
					org_id: cert.org_id,
					user_id: cert.user_id,
					message: `Certificate expired: ${cert.subject_cn}`,
					details: {
						certificate_id: cert.id,
						serial_hex: cert.serial_hex,
						app_id: cert.app_id ?? undefined,
					},
				});
				expired += 1;
				continue;
			}

			const meta = (cert.metadata as Record<string, string> | null) ?? {};
			if (meta.expiry_notified_date === today) {
				continue;
			}
			await db
				.updateTable("org_certificates")
				.set({
					metadata: normalizeMetadata({ ...meta, expiry_notified_date: today }),
					updated_at: now,
				})
				.where("id", "=", cert.id)
				.execute();
			await AuditLogService.notifyAuditSystem({
				action: "cert_expiring",
				org_id: cert.org_id,
				user_id: cert.user_id,
				message: `Certificate expiring: ${cert.subject_cn}`,
				details: {
					certificate_id: cert.id,
					serial_hex: cert.serial_hex,
					app_id: cert.app_id ?? undefined,
					not_after: notAfter.toISOString(),
				},
			});
			expiring += 1;
		}

		if (expired || expiring) {
			const orgIds = [...new Set(due.map(cert => cert.org_id))];
			await Promise.all(orgIds.map(orgId => invalidateCache(CacheKeys.certsByOrg(orgId))));
		}

		return { expired, expiring };
	};

	public static setAutoRenew = async ({
		id,
		org_id,
		auto_renew,
		renew_days_before = 30,
		env_type_id,
	}: {
		id: string;
		org_id: string;
		auto_renew: boolean;
		renew_days_before?: number;
		env_type_id?: string | null;
	}) => {
		if (!EditionPolicyService.isEnterprise()) {
			throw new BusinessRuleError(
				"Auto-renew requires the Enterprise edition.",
				403,
				"ENTERPRISE_REQUIRED",
			);
		}
		await PlanLimitService.assertFeature(org_id, "certificates");
		const cert = await this.getCertificate(id);
		if (cert.org_id !== org_id) {
			throw new NotFoundError("Certificate", id);
		}
		if (cert.cert_type !== "leaf") {
			throw new BusinessRuleError("Auto-renew is only available for service certificates.");
		}
		const meta = (cert.metadata as Record<string, string> | null) ?? {};
		if (meta.issued_source === "csr") {
			throw new BusinessRuleError("CSR-signed certificates cannot auto-renew; the private key is client-held.");
		}
		if (auto_renew && (env_type_id || cert.env_type_id)) {
			const envType = await EnvTypeService.getEnvType(env_type_id || cert.env_type_id!);
			if (envType.org_id !== org_id) {
				throw new NotFoundError("EnvType", env_type_id || cert.env_type_id!);
			}
		}

		const db = await DB.getInstance();
		const now = new Date();
		await db
			.updateTable("org_certificates")
			.set({
				auto_renew,
				renew_days_before,
				env_type_id: env_type_id === undefined ? cert.env_type_id : env_type_id,
				updated_at: now,
			})
			.where("id", "=", id)
			.execute();
		await invalidateCache(CacheKeys.certsByOrg(org_id));
		return this.getCertificate(id);
	};

	public static processAutoRenewals = async (now = new Date()) => {
		if (!EditionPolicyService.isEnterprise()) {
			return { renewed: 0 };
		}
		const db = await DB.getInstance();
		const candidates = await db
			.selectFrom("org_certificates")
			.selectAll()
			.where("status", "=", "active")
			.where("cert_type", "=", "leaf")
			.where("auto_renew", "=", true)
			.where("not_after", "is not", null)
			.execute();

		let renewed = 0;
		for (const cert of candidates) {
			if (!cert.not_after || !cert.app_id) {
				continue;
			}
			const windowMs = (cert.renew_days_before || 30) * 24 * 60 * 60 * 1000;
			if (new Date(cert.not_after).getTime() > now.getTime() + windowMs) {
				continue;
			}
			const meta = (cert.metadata as Record<string, string> | null) ?? {};
			if (meta.issued_source === "csr") {
				continue;
			}
			try {
				await this.renewLeaf(cert, now);
				renewed += 1;
			} catch (error) {
				await AuditLogService.notifyAuditSystem({
					action: "certificate_renewed",
					org_id: cert.org_id,
					user_id: cert.user_id,
					message: `Auto-renew failed for ${cert.subject_cn}`,
					details: {
						certificate_id: cert.id,
						error: error instanceof Error ? error.message : String(error),
						app_id: cert.app_id ?? undefined,
					},
				});
			}
		}
		return { renewed };
	};

	private static renewLeaf = async (
		cert: {
			id: string;
			org_id: string;
			user_id: string;
			app_id?: string | null;
			env_type_id?: string | null;
			subject_cn: string;
			sans: string[];
			description?: string | null;
			auto_renew: boolean;
			renew_days_before: number;
		},
		now = new Date(),
	) => {
		const issued = await this.issueLeaf({
			org_id: cert.org_id,
			app_id: cert.app_id!,
			env_type_id: cert.env_type_id || undefined,
			issued_by_user_id: cert.user_id,
			common_name: cert.subject_cn,
			sans: cert.sans ?? [],
			ttl_days: 90,
			description: cert.description || undefined,
		});

		const db = await DB.getInstance();
		await db
			.updateTable("org_certificates")
			.set({
				auto_renew: cert.auto_renew,
				renew_days_before: cert.renew_days_before,
				supersedes_certificate_id: cert.id,
				updated_at: now,
			})
			.where("id", "=", issued.id)
			.execute();
		await db
			.updateTable("org_certificates")
			.set({ status: "superseded", updated_at: now })
			.where("id", "=", cert.id)
			.execute();

		if (cert.env_type_id && issued.cert_pem && issued.key_pem) {
			await this.writeTlsSecrets({
				org_id: cert.org_id,
				app_id: cert.app_id!,
				env_type_id: cert.env_type_id,
				user_id: cert.user_id,
				cert_pem: issued.cert_pem,
				key_pem: issued.key_pem,
				subject_cn: cert.subject_cn,
			});
		}

		await AuditLogService.notifyAuditSystem({
			action: "certificate_renewed",
			org_id: cert.org_id,
			user_id: cert.user_id,
			message: `Service certificate auto-renewed: ${cert.subject_cn}`,
			details: {
				certificate_id: issued.id,
				supersedes_certificate_id: cert.id,
				app_id: cert.app_id ?? undefined,
			},
		});
		return issued;
	};

	private static writeTlsSecrets = async ({
		org_id,
		app_id,
		env_type_id,
		user_id,
		cert_pem,
		key_pem,
		subject_cn,
	}: {
		org_id: string;
		app_id: string;
		env_type_id: string;
		user_id: string;
		cert_pem: string;
		key_pem: string;
		subject_cn: string;
	}) => {
		const envType = await EnvTypeService.getEnvType(env_type_id);
		const entries = [
			{ key: "ENVSYNC_TLS_CERT", value: cert_pem },
			{ key: "ENVSYNC_TLS_KEY", value: key_pem },
		];
		if (envType.is_protected) {
			await ChangeRequestService.createDirect({
				org_id,
				app_id,
				target_env_type_id: env_type_id,
				requested_by_user_id: user_id,
				title: `Auto-renew TLS for ${subject_cn}`,
				message: "Managed leaf certificate auto-renewed; apply to update project secrets.",
				secrets: entries.map(entry => ({
					key: entry.key,
					operation: "UPDATE" as const,
					proposed_value: entry.value,
				})),
			});
			return;
		}

		for (const entry of entries) {
			try {
				await SecretService.getSecret({
					key: entry.key,
					env_type_id,
					app_id,
					org_id,
					user_id,
				});
				await SecretService.updateSecret({
					key: entry.key,
					value: entry.value,
					env_type_id,
					app_id,
					org_id,
					user_id,
				});
			} catch {
				await SecretService.createSecret({
					key: entry.key,
					value: entry.value,
					env_type_id,
					app_id,
					org_id,
					user_id,
				});
			}
		}
	};
}

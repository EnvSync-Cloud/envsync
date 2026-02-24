import { v4 as uuidv4 } from "uuid";

import { DB, JsonValue } from "@/libs/db";
import { KMSClient } from "@/libs/kms/client";
import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { orNotFound, ConflictError, BusinessRuleError } from "@/libs/errors";
import { runSaga } from "@/helpers/saga";
import { AuthorizationService } from "@/services/authorization.service";

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

export class CertificateService {
	public static initOrgCA = async (
		org_id: string,
		org_name: string,
		user_id: string,
		description?: string,
		metadata?: Record<string, string>,
	) => {
		const db = await DB.getInstance();
		const existing = await db
			.selectFrom("org_certificates")
			.selectAll()
			.where("org_id", "=", org_id)
			.where("cert_type", "=", "org_ca")
			.where("status", "=", "active")
			.executeTakeFirst();

		if (existing) {
			throw new ConflictError("Organization CA already initialized");
		}

		let certRow: (Record<string, unknown> & { id: string; serial_hex: string }) | undefined;
		let certId: string | undefined;
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
					const result = await db
						.insertInto("org_certificates")
						.values({
							id: uuidv4(),
							org_id,
							user_id,
							serial_hex: serialHex,
							cert_type: "org_ca",
							subject_cn: `${org_name} CA`,
							status: "active",
							description: description || null,
							metadata: metadata ? new JsonValue(metadata) : new JsonValue({}),
							created_at: now,
							updated_at: now,
						})
						.returningAll()
						.executeTakeFirstOrThrow();
					certRow = result;
					certId = result.id;
				},
				compensate: async () => {
					if (certId) {
						await db.deleteFrom("org_certificates").where("id", "=", certId).execute();
					}
				},
			},
			{
				name: "fga-write",
				execute: async () => {
					await AuthorizationService.writeCertificateRelations(certId!, org_id, user_id);
				},
				compensate: async () => {
					if (certId) {
						await AuthorizationService.deleteResourceTuples("certificate", certId);
					}
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.certsByOrg(org_id));
				},
			},
		]);

		return {
			...certRow!,
			cert_pem: certPem,
		};
	};

	public static issueMemberCert = async (
		org_id: string,
		user_id: string,
		member_email: string,
		role: string,
		description?: string,
		metadata?: Record<string, string>,
	) => {
		const db = await DB.getInstance();
		const orgCA = await db
			.selectFrom("org_certificates")
			.selectAll()
			.where("org_id", "=", org_id)
			.where("cert_type", "=", "org_ca")
			.where("status", "=", "active")
			.executeTakeFirst();

		if (!orgCA) {
			throw new BusinessRuleError("Organization CA not initialized. Initialize CA first.");
		}

		let memberCertRow: (Record<string, unknown> & { id: string; serial_hex: string }) | undefined;
		let memberCertId: string | undefined;
		let memberCertPem = "";
		let memberKeyPem = "";
		let memberSerialHex = "";

		await runSaga("issueMemberCert", {}, [
			{
				name: "kms-issue-cert",
				execute: async () => {
					const kms = await KMSClient.getInstance();
					const result = await kms.issueMemberCert(user_id, member_email, org_id, role);
					memberCertPem = result.certPem;
					memberKeyPem = result.keyPem;
					memberSerialHex = result.serialHex;
				},
			},
			{
				name: "db-insert",
				execute: async () => {
					const now = new Date();
					const result = await db
						.insertInto("org_certificates")
						.values({
							id: uuidv4(),
							org_id,
							user_id,
							serial_hex: memberSerialHex,
							cert_type: "member",
							subject_cn: member_email,
							subject_email: member_email,
							status: "active",
							description: description || null,
							metadata: metadata ? new JsonValue(metadata) : new JsonValue({}),
							created_at: now,
							updated_at: now,
						})
						.returningAll()
						.executeTakeFirstOrThrow();
					memberCertRow = result;
					memberCertId = result.id;
				},
				compensate: async () => {
					if (memberCertId) {
						await db.deleteFrom("org_certificates").where("id", "=", memberCertId).execute();
					}
				},
			},
			{
				name: "fga-write",
				execute: async () => {
					await AuthorizationService.writeCertificateRelations(memberCertId!, org_id, user_id);
				},
				compensate: async () => {
					if (memberCertId) {
						await AuthorizationService.deleteResourceTuples("certificate", memberCertId);
					}
				},
			},
			{
				name: "cache-invalidate",
				execute: async () => {
					await invalidateCache(CacheKeys.certsByOrg(org_id));
				},
			},
		]);

		return {
			...memberCertRow!,
			cert_pem: memberCertPem,
			key_pem: memberKeyPem,
		};
	};

	public static listCertificates = async (org_id: string, page = 1, per_page = 50) => {
		const db = await DB.getInstance();
		return db
			.selectFrom("org_certificates")
			.selectAll()
			.where("org_id", "=", org_id)
			.orderBy("created_at", "desc")
			.limit(per_page)
			.offset((page - 1) * per_page)
			.execute();
	};

	public static getCertificate = async (id: string) => {
		const db = await DB.getInstance();
		return orNotFound(
			db
				.selectFrom("org_certificates")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"Certificate",
			id,
		);
	};

	public static getOrgCA = async (org_id: string) => {
		const db = await DB.getInstance();
		return db
			.selectFrom("org_certificates")
			.selectAll()
			.where("org_id", "=", org_id)
			.where("cert_type", "=", "org_ca")
			.where("status", "=", "active")
			.executeTakeFirst();
	};

	public static revokeCert = async (serial_hex: string, org_id: string, reason: number) => {
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
}

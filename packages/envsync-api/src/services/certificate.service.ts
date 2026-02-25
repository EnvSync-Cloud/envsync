import { STDBClient } from "@/libs/stdb";
import { invalidateCache } from "@/helpers/cache";
import { CacheKeys } from "@/helpers/cache-keys";
import { ConflictError, BusinessRuleError, NotFoundError } from "@/libs/errors";
import { runSaga } from "@/helpers/saga";
import { AuthorizationService } from "@/services/authorization.service";

const OCSP_STATUS_MAP: Record<number, string> = {
	0: "good",
	1: "revoked",
	2: "unknown",
};

interface CertMetaRow {
	uuid: string;
	org_id: string;
	user_id: string;
	serial_hex: string;
	cert_type: string;
	subject_cn: string;
	subject_email: string | null;
	status: string;
	description: string | null;
	metadata: string;
	revoked_at: string | null;
	revocation_reason: number | null;
	created_at: string;
	updated_at: string;
}

function mapCertRow(row: CertMetaRow) {
	return {
		id: row.uuid,
		org_id: row.org_id,
		user_id: row.user_id,
		serial_hex: row.serial_hex,
		cert_type: row.cert_type,
		subject_cn: row.subject_cn,
		subject_email: row.subject_email,
		status: row.status,
		description: row.description,
		metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
		revoked_at: row.revoked_at ? new Date(row.revoked_at) : null,
		revocation_reason: row.revocation_reason,
		created_at: new Date(row.created_at),
		updated_at: new Date(row.updated_at),
	};
}

export class CertificateService {
	public static initOrgCA = async (
		org_id: string,
		org_name: string,
		user_id: string,
		description?: string,
		metadata?: Record<string, string>,
	) => {
		const stdb = STDBClient.getInstance();

		const existing = await stdb.queryOne<CertMetaRow>(
			`SELECT * FROM org_certificate_meta WHERE org_id = '${org_id}' AND cert_type = 'org_ca' AND status = 'active'`,
		);

		if (existing) {
			throw new ConflictError("Organization CA already initialized");
		}

		const id = crypto.randomUUID();
		let certRow: Record<string, unknown> | undefined;
		let certPem = "";
		let serialHex = "";

		await runSaga("initOrgCA", {}, [
			{
				name: "stdb-create-ca",
				execute: async () => {
					const resultJson = await stdb.callReducer<string>("create_org_ca", [org_id, org_name]);
					const result = JSON.parse(resultJson);
					certPem = result.cert_pem;
					serialHex = result.serial_hex;
				},
			},
			{
				name: "stdb-insert-meta",
				execute: async () => {
					await stdb.callReducer("create_org_certificate_meta", [
						id,
						org_id,
						user_id,
						serialHex,
						"org_ca",
						`${org_name} CA`,
						null,
						"active",
						description || null,
						JSON.stringify(metadata || {}),
					]);

					certRow = {
						id,
						org_id,
						user_id,
						serial_hex: serialHex,
						cert_type: "org_ca",
						subject_cn: `${org_name} CA`,
						subject_email: null,
						status: "active",
						description: description || null,
						metadata: metadata || {},
						revoked_at: null,
						revocation_reason: null,
						created_at: new Date(),
						updated_at: new Date(),
					};
				},
				compensate: async () => {
					await stdb.callReducer("delete_org_certificate_meta", [id]);
				},
			},
			{
				name: "auth-write",
				execute: async () => {
					await AuthorizationService.writeCertificateRelations(id, org_id, user_id);
				},
				compensate: async () => {
					await AuthorizationService.deleteResourceTuples("certificate", id);
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
		const stdb = STDBClient.getInstance();

		const orgCA = await stdb.queryOne<CertMetaRow>(
			`SELECT * FROM org_certificate_meta WHERE org_id = '${org_id}' AND cert_type = 'org_ca' AND status = 'active'`,
		);

		if (!orgCA) {
			throw new BusinessRuleError("Organization CA not initialized. Initialize CA first.");
		}

		const id = crypto.randomUUID();
		let memberCertRow: Record<string, unknown> | undefined;
		let memberCertPem = "";
		let memberKeyPem = "";
		let memberSerialHex = "";

		await runSaga("issueMemberCert", {}, [
			{
				name: "stdb-issue-cert",
				execute: async () => {
					const resultJson = await stdb.callReducer<string>(
						"issue_member_cert",
						[user_id, member_email, org_id, role],
					);
					const result = JSON.parse(resultJson);
					memberCertPem = result.cert_pem;
					memberKeyPem = result.key_pem;
					memberSerialHex = result.serial_hex;
				},
			},
			{
				name: "stdb-insert-meta",
				execute: async () => {
					await stdb.callReducer("create_org_certificate_meta", [
						id,
						org_id,
						user_id,
						memberSerialHex,
						"member",
						member_email,
						member_email,
						"active",
						description || null,
						JSON.stringify(metadata || {}),
					]);

					memberCertRow = {
						id,
						org_id,
						user_id,
						serial_hex: memberSerialHex,
						cert_type: "member",
						subject_cn: member_email,
						subject_email: member_email,
						status: "active",
						description: description || null,
						metadata: metadata || {},
						revoked_at: null,
						revocation_reason: null,
						created_at: new Date(),
						updated_at: new Date(),
					};
				},
				compensate: async () => {
					await stdb.callReducer("delete_org_certificate_meta", [id]);
				},
			},
			{
				name: "auth-write",
				execute: async () => {
					await AuthorizationService.writeCertificateRelations(id, org_id, user_id);
				},
				compensate: async () => {
					await AuthorizationService.deleteResourceTuples("certificate", id);
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
		const stdb = STDBClient.getInstance();
		const offset = (page - 1) * per_page;

		const rows = await stdb.query<CertMetaRow>(
			`SELECT * FROM org_certificate_meta WHERE org_id = '${org_id}' ORDER BY created_at DESC LIMIT ${per_page} OFFSET ${offset}`,
		);

		return rows.map(mapCertRow);
	};

	public static getCertificate = async (id: string) => {
		const stdb = STDBClient.getInstance();
		const row = await stdb.queryOne<CertMetaRow>(
			`SELECT * FROM org_certificate_meta WHERE uuid = '${id}'`,
		);

		if (!row) throw new NotFoundError("Certificate", id);

		return mapCertRow(row);
	};

	public static getOrgCA = async (org_id: string) => {
		const stdb = STDBClient.getInstance();
		const row = await stdb.queryOne<CertMetaRow>(
			`SELECT * FROM org_certificate_meta WHERE org_id = '${org_id}' AND cert_type = 'org_ca' AND status = 'active'`,
		);

		if (!row) return undefined;

		return mapCertRow(row);
	};

	public static revokeCert = async (serial_hex: string, org_id: string, reason: number) => {
		const stdb = STDBClient.getInstance();
		await stdb.callReducer("revoke_cert", [serial_hex, org_id, reason], { injectRootKey: false });

		await stdb.callReducer("revoke_org_certificate_meta", [
			serial_hex,
			org_id,
			reason,
		]);

		await invalidateCache(CacheKeys.certsByOrg(org_id));

		return {
			serial_hex,
			status: "revoked",
		};
	};

	public static getCRL = async (org_id: string, deltaOnly: boolean) => {
		const stdb = STDBClient.getInstance();
		const resultJson = await stdb.callReducer<string>("get_crl", [org_id, deltaOnly], { injectRootKey: false });
		const result = JSON.parse(resultJson);

		return {
			crl_pem: resultJson, // CRL is returned as JSON with revoked serials
			crl_number: result.crl_number,
			is_delta: result.is_delta,
		};
	};

	public static checkOCSP = async (serialHex: string, org_id: string) => {
		const stdb = STDBClient.getInstance();
		const resultJson = await stdb.callReducer<string>("check_ocsp", [serialHex, org_id], { injectRootKey: false });
		const result = JSON.parse(resultJson);

		return {
			status: OCSP_STATUS_MAP[result.status] || "unknown",
			revoked_at: result.revoked_at || null,
		};
	};

	public static getRootCA = async () => {
		const stdb = STDBClient.getInstance();
		const resultJson = await stdb.callReducer<string>("get_root_ca", [], { injectRootKey: false });
		const result = JSON.parse(resultJson);
		return { cert_pem: result.cert_pem };
	};
}

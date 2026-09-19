import { type Context } from "hono";

import { CertificateService } from "@/services/certificate.service";
import { AuditLogService } from "@/services/audit_log.service";
import { CertificateRoleMapper } from "@/services/certificate-role.mapper";
import { RoleService } from "@/services/role.service";
import { UserService } from "@/services/user.service";
import { BusinessRuleError } from "@/libs/errors";

export class CertificateController {
	public static readonly initOrgCA = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { org_name, description, metadata } = await c.req.json();

		const cert = await CertificateService.initOrgCA(org_id, org_name, user_id, description, metadata);

		await AuditLogService.notifyAuditSystem({
			action: "cert_ca_initialized",
			org_id,
			user_id,
			message: `Organization CA initialized: ${org_name}`,
			details: {
				certificate_id: cert.id,
				serial_hex: cert.serial_hex,
			},
		});

		return c.json(cert, 201);
	};

	public static readonly getOrgCA = async (c: Context) => {
		const org_id = c.get("org_id");

		const ca = await CertificateService.getOrgCA(org_id);
		if (!ca) {
			return c.json({ error: "Organization CA not initialized." }, 404);
		}

		return c.json(ca, 200);
	};

	public static readonly getRootCA = async (c: Context) => {
		const result = await CertificateService.getRootCA();
		return c.json(result, 200);
	};

	public static readonly getChain = async (c: Context) => {
		const org_id = c.get("org_id");
		const chain = await CertificateService.getChain(org_id);
		return c.json(chain, 200);
	};

	public static readonly importChain = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const body = await c.req.json();
		const cert = await CertificateService.importChain({
			org_id,
			user_id,
			chain_pem: body.chain_pem,
			env_type_id: body.env_type_id,
			description: body.description,
		});
		return c.json(cert, 201);
	};

	public static readonly labelEnvCa = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const body = await c.req.json();
		const cert = await CertificateService.labelEnvCa({
			org_id,
			user_id,
			env_type_id: body.env_type_id,
			name: body.name,
		});
		return c.json(cert, 201);
	};

	public static readonly issueLeaf = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const body = await c.req.json();
		const cert = await CertificateService.issueLeaf({
			org_id,
			app_id: body.app_id,
			env_type_id: body.env_type_id,
			issued_by_user_id: user_id,
			common_name: body.common_name,
			sans: body.sans,
			ttl_days: body.ttl_days,
			key_algorithm: body.key_algorithm,
			description: body.description,
		});
		await AuditLogService.notifyAuditSystem({
			action: "cert_leaf_issued",
			org_id,
			user_id,
			message: `Leaf certificate issued: ${body.common_name}`,
			details: { certificate_id: cert.id, serial_hex: cert.serial_hex, app_id: body.app_id },
		});
		return c.json(cert, 201);
	};

	public static readonly signCsr = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const body = await c.req.json();
		const cert = await CertificateService.signCsr({
			org_id,
			app_id: body.app_id,
			issued_by_user_id: user_id,
			csr_pem: body.csr_pem,
			ttl_days: body.ttl_days,
			description: body.description,
		});
		await AuditLogService.notifyAuditSystem({
			action: "cert_csr_signed",
			org_id,
			user_id,
			message: `CSR signed: ${cert.subject_cn}`,
			details: { certificate_id: cert.id, serial_hex: cert.serial_hex },
		});
		return c.json(cert, 201);
	};

	public static readonly issueMemberCert = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { member_email, description, metadata } = await c.req.json();

		const member = await UserService.getOrgUserByEmail(org_id, member_email);
		if (!member) {
			throw new BusinessRuleError(
				`Member not found for email ${member_email}.`,
				404,
				"MEMBER_NOT_FOUND",
			);
		}

		const existingManualCert = await CertificateService.getLatestActiveManualMemberCert(
			org_id,
			member.id,
		);
		if (existingManualCert) {
			throw new BusinessRuleError(
				`Active member certificate already exists for ${member_email}. Use renew, rotate, or revoke first.`,
				409,
				"ACTIVE_MEMBER_CERT_EXISTS",
			);
		}

		const role = await RoleService.getRole(member.role_id);

		const cert = await CertificateService.issueMemberCert({
			org_id,
			target_user_id: member.id,
			target_email: member_email,
			issued_by_user_id: user_id,
			envsync_pki_role: CertificateRoleMapper.toPkiRole(role),
			is_system_generated: false,
			persist_private_key: false,
			description,
			metadata,
		});

		await AuditLogService.notifyAuditSystem({
			action: "cert_member_issued",
			org_id,
			user_id,
			message: `Member certificate issued for: ${member_email}`,
			details: {
				certificate_id: cert.id,
				serial_hex: cert.serial_hex,
				member_email,
				role_id: role.id,
				role_name: role.name,
				envsync_pki_role: CertificateRoleMapper.toPkiRole(role),
				is_system_generated: false,
			},
		});

		return c.json(cert, 201);
	};

	public static readonly listCertificates = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");

		const page = Math.max(1, Number(c.req.query("page")) || 1);
		const per_page = Math.min(100, Math.max(1, Number(c.req.query("per_page")) || 50));
		const include_system_generated = c.req.query("include_system_generated") === "true";

		const certs = await CertificateService.listCertificates(
			org_id,
			page,
			per_page,
			include_system_generated,
		);

		await AuditLogService.notifyAuditSystem({
			action: "certs_viewed",
			org_id,
			user_id,
			message: "Certificates list viewed",
			details: { count: certs.length, include_system_generated },
		});

		return c.json(certs, 200);
	};

	public static readonly getCertificate = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const id = c.req.param("id");

		const cert = await CertificateService.getCertificate(id);

		if (cert.org_id !== org_id) {
			return c.json({ error: "Certificate not found" }, 404);
		}

		await AuditLogService.notifyAuditSystem({
			action: "cert_viewed",
			org_id,
			user_id,
			message: `Certificate viewed: ${cert.serial_hex}`,
			details: { certificate_id: id, serial_hex: cert.serial_hex },
		});

		return c.json(cert, 200);
	};

	public static readonly getMyCertificateBundle = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");

		const bundle = await CertificateService.getMyCertificateBundle(org_id, user_id);

		await AuditLogService.notifyAuditSystem({
			action: "cert_bundle_retrieved",
			org_id,
			user_id,
			message: "System certificate bundle retrieved.",
			details: {
				member_certificate_id: bundle.member_certificate.id,
				serial_hex: bundle.member_certificate.serial_hex,
			},
		});

		return c.json(bundle, 200);
	};

	public static readonly revokeCert = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const serial_hex = c.req.param("serial_hex");
		const { reason } = await c.req.json();

		const result = await CertificateService.revokeCert(serial_hex, org_id, reason);

		await AuditLogService.notifyAuditSystem({
			action: "cert_revoked",
			org_id,
			user_id,
			message: `Certificate revoked: ${serial_hex}`,
			details: { serial_hex, reason },
		});

		return c.json({ message: "Certificate revoked successfully.", ...result }, 200);
	};

	public static readonly getCRL = async (c: Context) => {
		const org_id = c.get("org_id");
		const deltaOnly = c.req.query("delta_only") === "true";

		const result = await CertificateService.getCRL(org_id, deltaOnly);

		return c.json(result, 200);
	};

	public static readonly checkOCSP = async (c: Context) => {
		const org_id = c.get("org_id");
		const serial_hex = c.req.param("serial_hex");

		const result = await CertificateService.checkOCSP(serial_hex, org_id);

		return c.json(result, 200);
	};

	public static readonly renewCert = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const id = c.req.param("id");
		const { revoke_previous = true, reason = 0, description } = await c.req.json();

		const cert = await CertificateService.renewCert({
			id,
			org_id,
			user_id,
			revoke_previous,
			reason,
			description,
		});

		await AuditLogService.notifyAuditSystem({
			action: "certificate_renewed",
			org_id,
			user_id,
			message: `Certificate renewed: ${id}`,
			details: { certificate_id: id, revoke_previous },
		});

		return c.json(cert, 200);
	};

	public static readonly rotateCert = async (c: Context) => {
		return this.renewCert(c);
	};

	public static readonly setAutoRenew = async (c: Context) => {
		const org_id = c.get("org_id");
		const id = c.req.param("id");
		const body = await c.req.json();
		const cert = await CertificateService.setAutoRenew({
			id,
			org_id,
			auto_renew: body.auto_renew,
			renew_days_before: body.renew_days_before,
			env_type_id: body.env_type_id,
		});
		return c.json(cert, 200);
	};
}

import { type Context } from "hono";

import { CertificateService } from "@/services/certificate.service";
import { AuditLogService } from "@/services/audit_log.service";

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

	public static readonly issueMemberCert = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const { member_email, role, description, metadata } = await c.req.json();

		const cert = await CertificateService.issueMemberCert(
			org_id,
			user_id,
			member_email,
			role,
			description,
			metadata,
		);

		await AuditLogService.notifyAuditSystem({
			action: "cert_member_issued",
			org_id,
			user_id,
			message: `Member certificate issued for: ${member_email}`,
			details: {
				certificate_id: cert.id,
				serial_hex: cert.serial_hex,
				member_email,
				role,
			},
		});

		return c.json(cert, 201);
	};

	public static readonly listCertificates = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");

		const page = Math.max(1, Number(c.req.query("page")) || 1);
		const per_page = Math.min(100, Math.max(1, Number(c.req.query("per_page")) || 50));

		const certs = await CertificateService.listCertificates(org_id, page, per_page);

		await AuditLogService.notifyAuditSystem({
			action: "certs_viewed",
			org_id,
			user_id,
			message: "Certificates list viewed",
			details: { count: certs.length },
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
}

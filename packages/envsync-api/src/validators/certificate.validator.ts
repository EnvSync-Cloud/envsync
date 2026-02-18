import z from "zod";
import "zod-openapi/extend";

// ─── Request schemas ────────────────────────────────────────────────

export const initOrgCARequestSchema = z
	.object({
		org_name: z.string().min(1).openapi({ example: "My Organization" }),
		description: z.string().optional().openapi({ example: "Organization CA certificate" }),
	})
	.openapi({ ref: "InitOrgCARequest" });

export const issueMemberCertRequestSchema = z
	.object({
		member_email: z.string().email().openapi({ example: "user@example.com" }),
		role: z.string().min(1).openapi({ example: "developer" }),
		description: z.string().optional().openapi({ example: "Developer certificate" }),
		metadata: z.record(z.string(), z.string()).optional().openapi({ example: { service: "api-gateway", env: "prod" } }),
	})
	.openapi({ ref: "IssueMemberCertRequest" });

export const revokeCertRequestSchema = z
	.object({
		reason: z.number().int().min(0).max(10).openapi({ example: 0 }),
	})
	.openapi({ ref: "RevokeCertRequest" });

export const getCRLQuerySchema = z
	.object({
		delta_only: z.string().optional().openapi({ example: "false" }),
	})
	.openapi({ ref: "GetCRLQuery" });

// ─── Response schemas ───────────────────────────────────────────────

export const orgCAResponseSchema = z
	.object({
		id: z.string().openapi({ example: "uuid" }),
		org_id: z.string().openapi({ example: "org_123" }),
		serial_hex: z.string().openapi({ example: "01AB" }),
		cert_type: z.string().openapi({ example: "org_ca" }),
		subject_cn: z.string().openapi({ example: "My Organization CA" }),
		status: z.string().openapi({ example: "active" }),
		cert_pem: z.string().optional().openapi({ example: "-----BEGIN CERTIFICATE-----..." }),
		created_at: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "OrgCAResponse" });

export const memberCertResponseSchema = z
	.object({
		id: z.string().openapi({ example: "uuid" }),
		org_id: z.string().openapi({ example: "org_123" }),
		serial_hex: z.string().openapi({ example: "02CD" }),
		cert_type: z.string().openapi({ example: "member" }),
		subject_cn: z.string().openapi({ example: "user@example.com" }),
		subject_email: z.string().nullable().openapi({ example: "user@example.com" }),
		status: z.string().openapi({ example: "active" }),
		metadata: z.record(z.string(), z.string()).nullable().optional().openapi({ example: { service: "api-gateway" } }),
		cert_pem: z.string().openapi({ example: "-----BEGIN CERTIFICATE-----..." }),
		key_pem: z.string().openapi({ example: "-----BEGIN PRIVATE KEY-----..." }),
		created_at: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "MemberCertResponse" });

export const certificateListResponseSchema = z
	.array(
		z.object({
			id: z.string().openapi({ example: "uuid" }),
			org_id: z.string().openapi({ example: "org_123" }),
			serial_hex: z.string().openapi({ example: "01AB" }),
			cert_type: z.string().openapi({ example: "org_ca" }),
			subject_cn: z.string().openapi({ example: "My Organization" }),
			subject_email: z.string().nullable().openapi({ example: null }),
			status: z.string().openapi({ example: "active" }),
			not_before: z.string().nullable().openapi({ example: null }),
			not_after: z.string().nullable().openapi({ example: null }),
			description: z.string().nullable().openapi({ example: null }),
			metadata: z.record(z.string(), z.string()).nullable().optional().openapi({ example: null }),
			revoked_at: z.string().nullable().openapi({ example: null }),
			created_at: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
			updated_at: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
		}),
	)
	.openapi({ ref: "CertificateListResponse" });

export const revokeCertResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Certificate revoked successfully." }),
		serial_hex: z.string().openapi({ example: "01AB" }),
		status: z.string().openapi({ example: "revoked" }),
	})
	.openapi({ ref: "RevokeCertResponse" });

export const crlResponseSchema = z
	.object({
		crl_pem: z.string().openapi({ example: "-----BEGIN X509 CRL-----..." }),
		crl_number: z.number().openapi({ example: 1 }),
		is_delta: z.boolean().openapi({ example: false }),
	})
	.openapi({ ref: "CRLResponse" });

export const ocspResponseSchema = z
	.object({
		status: z.string().openapi({ example: "good" }),
		revoked_at: z.string().nullable().openapi({ example: null }),
	})
	.openapi({ ref: "OCSPResponse" });

export const rootCAResponseSchema = z
	.object({
		cert_pem: z.string().openapi({ example: "-----BEGIN CERTIFICATE-----..." }),
	})
	.openapi({ ref: "RootCAResponse" });

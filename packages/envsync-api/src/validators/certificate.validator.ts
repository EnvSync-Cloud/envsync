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
		role: z.string().min(1).optional().openapi({ example: "developer" }),
		description: z.string().optional().openapi({ example: "Developer certificate" }),
		metadata: z.record(z.string(), z.string()).optional().openapi({ example: { service: "api-gateway", env: "prod" } }),
	})
	.openapi({ ref: "IssueMemberCertRequest" });

export const issueLeafCertRequestSchema = z
	.object({
		app_id: z.string().min(1).openapi({ example: "app_123" }),
		env_type_id: z.string().optional(),
		common_name: z.string().min(1).max(253).openapi({ example: "api.internal" }),
		sans: z.array(z.string().min(1).max(253)).max(20).optional().openapi({ example: ["api.internal"] }),
		ttl_days: z.number().int().min(1).max(825).optional().openapi({ example: 90 }),
		key_algorithm: z.enum(["ECDSA_P256", "RSA_2048"]).optional().openapi({ example: "ECDSA_P256" }),
		description: z.string().optional(),
	})
	.openapi({ ref: "IssueLeafCertRequest" });

export const signCsrRequestSchema = z
	.object({
		app_id: z.string().optional(),
		csr_pem: z.string().min(32).openapi({ example: "-----BEGIN CERTIFICATE REQUEST-----" }),
		ttl_days: z.number().int().min(1).max(825).optional().openapi({ example: 90 }),
		description: z.string().optional(),
	})
	.openapi({ ref: "SignCsrRequest" });

const certificateMetadataSchema = z.record(z.string(), z.string()).nullable().optional();
const baseCertificateFields = {
	id: z.string().openapi({ example: "uuid" }),
	org_id: z.string().openapi({ example: "org_123" }),
	serial_hex: z.string().openapi({ example: "02CD" }),
	cert_type: z.string().openapi({ example: "member" }),
	subject_cn: z.string().openapi({ example: "user@example.com" }),
	subject_email: z.string().nullable().openapi({ example: "user@example.com" }),
	status: z.string().openapi({ example: "active" }),
	description: z.string().nullable().optional().openapi({ example: "Developer certificate" }),
	metadata: certificateMetadataSchema.openapi({ example: { service: "api-gateway" } }),
	cert_pem: z.string().nullable().optional().openapi({ example: "-----BEGIN CERTIFICATE-----..." }),
	is_system_generated: z.boolean().openapi({ example: false }),
	not_before: z.string().nullable().optional().openapi({ example: null }),
	not_after: z.string().nullable().optional().openapi({ example: null }),
	revoked_at: z.string().nullable().optional().openapi({ example: null }),
	supersedes_certificate_id: z.string().nullable().optional().openapi({ example: null }),
	created_at: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
	updated_at: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
} satisfies z.ZodRawShape;

const baseCertificateSchema = z
	.object(baseCertificateFields)
	.openapi({ ref: "BaseCertificateResponse" });

export const revokeCertRequestSchema = z
	.object({
		reason: z.number().int().min(0).max(10).openapi({ example: 0 }),
	})
	.openapi({ ref: "RevokeCertRequest" });

export const renewCertRequestSchema = z
	.object({
		description: z.string().optional(),
		revoke_previous: z.boolean().default(true),
	})
	.openapi({ ref: "RenewCertRequest" });

export const rotateCertRequestSchema = z
	.object({
		description: z.string().optional(),
		revoke_previous: z.boolean().default(true),
		reason: z.number().int().min(0).max(10).default(0),
	})
	.openapi({ ref: "RotateCertRequest" });

export const getCRLQuerySchema = z
	.object({
		delta_only: z.string().optional().openapi({ example: "false" }),
	})
	.openapi({ ref: "GetCRLQuery" });

// ─── Response schemas ───────────────────────────────────────────────

export const orgCAResponseSchema = z
	.object({
		...baseCertificateFields,
		cert_type: z.string().openapi({ example: "org_ca" }),
		subject_cn: z.string().openapi({ example: "My Organization CA" }),
	})
	.openapi({ ref: "OrgCAResponse" });

export const memberCertResponseSchema = z
	.object({
		...baseCertificateFields,
		cert_type: z.string().openapi({ example: "member" }),
		key_pem: z.string().openapi({ example: "-----BEGIN PRIVATE KEY-----..." }),
	})
	.openapi({ ref: "MemberCertResponse" });

export const certificateListResponseSchema = z
	.array(baseCertificateSchema)
	.openapi({ ref: "CertificateListResponse" });

export const myCertificateBundleResponseSchema = z
	.object({
		root_ca_pem: z.string().openapi({ example: "-----BEGIN CERTIFICATE-----..." }),
		member_certificate: z.object({
			...baseCertificateFields,
			key_pem: z.string().openapi({ example: "-----BEGIN PRIVATE KEY-----..." }),
		}),
	})
	.openapi({ ref: "MyCertificateBundleResponse" });

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

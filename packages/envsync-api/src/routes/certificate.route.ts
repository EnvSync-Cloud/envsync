import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { CertificateController } from "@/controllers/certificate.controller";
import { requirePermission } from "@/middlewares/permission.middleware";
import {
	initOrgCARequestSchema,
	issueMemberCertRequestSchema,
	issueLeafCertRequestSchema,
	signCsrRequestSchema,
	revokeCertRequestSchema,
	renewCertRequestSchema,
	rotateCertRequestSchema,
	setAutoRenewRequestSchema,
	orgCAResponseSchema,
	memberCertResponseSchema,
	certificateListResponseSchema,
	revokeCertResponseSchema,
	crlResponseSchema,
	ocspResponseSchema,
	rootCAResponseSchema,
	myCertificateBundleResponseSchema,
} from "@/validators/certificate.validator";
import { errorResponseSchema } from "@/validators/common";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { cliMiddleware } from "@/middlewares/cli.middleware";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());

// ─── Named routes FIRST (before param routes) ─────────────────────

// Initialize org CA
app.post(
	"/ca/init",
	requirePermission("can_manage_certificates", "org"),
	describeRoute({
		operationId: "initOrgCA",
		summary: "Initialize Organization CA",
		description: "Create an intermediate CA for the organization via miniKMS",
		tags: ["Certificates"],
		responses: {
			201: {
				description: "Organization CA initialized successfully",
				content: { "application/json": { schema: resolver(orgCAResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", initOrgCARequestSchema),
	CertificateController.initOrgCA,
);

// Get org CA status
app.get(
	"/ca",
	requirePermission("can_view", "org"),
	describeRoute({
		operationId: "getOrgCA",
		summary: "Get Organization CA",
		description: "Retrieve the organization's intermediate CA certificate",
		tags: ["Certificates"],
		responses: {
			200: {
				description: "Organization CA retrieved successfully",
				content: { "application/json": { schema: resolver(orgCAResponseSchema) } },
			},
			404: {
				description: "Organization CA not initialized",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	CertificateController.getOrgCA,
);

// Get root CA
app.get(
	"/root-ca",
	describeRoute({
		operationId: "getRootCA",
		summary: "Get Root CA",
		description: "Retrieve the root CA certificate",
		tags: ["Certificates"],
		responses: {
			200: {
				description: "Root CA retrieved successfully",
				content: { "application/json": { schema: resolver(rootCAResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	CertificateController.getRootCA,
);

// Issue member certificate
app.post(
	"/issue",
	requirePermission("can_manage_certificates", "org"),
	describeRoute({
		operationId: "issueMemberCert",
		summary: "Issue Member Certificate",
		description: "Issue a new member certificate signed by the organization CA",
		tags: ["Certificates"],
		responses: {
			201: {
				description: "Member certificate issued successfully",
				content: { "application/json": { schema: resolver(memberCertResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", issueMemberCertRequestSchema),
	CertificateController.issueMemberCert,
);

app.post(
	"/issue-leaf",
	requirePermission("can_manage_certificates", "org"),
	describeRoute({
		operationId: "issueLeafCert",
		summary: "Issue service leaf certificate",
		description: "Issue a project-scoped leaf certificate with DNS/IP SANs. Private key is returned once.",
		tags: ["Certificates"],
		responses: {
			201: {
				description: "Leaf certificate issued",
				content: { "application/json": { schema: resolver(memberCertResponseSchema) } },
			},
		},
	}),
	zValidator("json", issueLeafCertRequestSchema),
	CertificateController.issueLeaf,
);

app.post(
	"/sign-csr",
	requirePermission("can_manage_certificates", "org"),
	describeRoute({
		operationId: "signCertificateCsr",
		summary: "Sign a CSR",
		description: "Sign a client-generated CSR with the organization CA. Private key never leaves the client.",
		tags: ["Certificates"],
		responses: {
			201: {
				description: "Certificate signed",
				content: { "application/json": { schema: resolver(orgCAResponseSchema) } },
			},
		},
	}),
	zValidator("json", signCsrRequestSchema),
	CertificateController.signCsr,
);

// Get CRL
app.get(
	"/crl",
	requirePermission("can_view", "org"),
	describeRoute({
		operationId: "getCRL",
		summary: "Get CRL",
		description: "Retrieve the Certificate Revocation List for the organization",
		tags: ["Certificates"],
		responses: {
			200: {
				description: "CRL retrieved successfully",
				content: { "application/json": { schema: resolver(crlResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	CertificateController.getCRL,
);

app.get(
	"/me",
	describeRoute({
		operationId: "getMyCertificateBundle",
		summary: "Get Current User Certificate Bundle",
		description: "Retrieve the current user's active system-generated certificate bundle",
		tags: ["Certificates"],
		responses: {
			200: {
				description: "Certificate bundle retrieved successfully",
				content: { "application/json": { schema: resolver(myCertificateBundleResponseSchema) } },
			},
			404: {
				description: "Certificate bundle not found",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	CertificateController.getMyCertificateBundle,
);

// List all certificates
app.get(
	"/",
	requirePermission("can_view", "org"),
	describeRoute({
		operationId: "listCertificates",
		summary: "List Certificates",
		description: "List all certificates for the organization",
		tags: ["Certificates"],
		responses: {
			200: {
				description: "Certificates retrieved successfully",
				content: { "application/json": { schema: resolver(certificateListResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	CertificateController.listCertificates,
);

// ─── Param routes ──────────────────────────────────────────────────

// Get a specific certificate
app.get(
	"/:id",
	requirePermission("can_view", "org"),
	describeRoute({
		operationId: "getCertificate",
		summary: "Get Certificate",
		description: "Retrieve a specific certificate by ID",
		tags: ["Certificates"],
		responses: {
			200: {
				description: "Certificate retrieved successfully",
				content: { "application/json": { schema: resolver(certificateListResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	CertificateController.getCertificate,
);

// Revoke a certificate
app.post(
	"/:serial_hex/revoke",
	requirePermission("can_manage_certificates", "org"),
	describeRoute({
		operationId: "revokeCert",
		summary: "Revoke Certificate",
		description: "Revoke a certificate by its serial number",
		tags: ["Certificates"],
		responses: {
			200: {
				description: "Certificate revoked successfully",
				content: { "application/json": { schema: resolver(revokeCertResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", revokeCertRequestSchema),
	CertificateController.revokeCert,
);

app.post(
	"/:id/renew",
	requirePermission("can_manage_certificates", "org"),
	describeRoute({
		operationId: "renewCertificate",
		summary: "Renew Certificate",
		description: "Issue a renewed replacement certificate linked to the existing certificate lineage.",
		tags: ["Certificates"],
		responses: {
			200: {
				description: "Certificate renewed successfully",
				content: { "application/json": { schema: resolver(memberCertResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", renewCertRequestSchema),
	CertificateController.renewCert,
);

app.post(
	"/:id/rotate",
	requirePermission("can_manage_certificates", "org"),
	describeRoute({
		operationId: "rotateCertificate",
		summary: "Rotate Certificate",
		description: "Rotate a certificate by issuing a replacement and optionally revoking the previous certificate.",
		tags: ["Certificates"],
		responses: {
			200: {
				description: "Certificate rotated successfully",
				content: { "application/json": { schema: resolver(memberCertResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", rotateCertRequestSchema),
	CertificateController.rotateCert,
);

app.patch(
	"/:id/auto-renew",
	requirePermission("can_manage_certificates", "org"),
	describeRoute({
		operationId: "setCertificateAutoRenew",
		summary: "Configure leaf auto-renew",
		description: "Enterprise-only. Auto-renew managed service certificates and optionally write ENVSYNC_TLS_* secrets.",
		tags: ["Certificates"],
		responses: {
			200: {
				description: "Auto-renew updated",
				content: { "application/json": { schema: resolver(orgCAResponseSchema) } },
			},
		},
	}),
	zValidator("json", setAutoRenewRequestSchema),
	CertificateController.setAutoRenew,
);

// Check OCSP status
app.get(
	"/:serial_hex/ocsp",
	requirePermission("can_view", "org"),
	describeRoute({
		operationId: "checkOCSP",
		summary: "Check OCSP Status",
		description: "Check the OCSP status of a certificate",
		tags: ["Certificates"],
		responses: {
			200: {
				description: "OCSP status retrieved successfully",
				content: { "application/json": { schema: resolver(ocspResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	CertificateController.checkOCSP,
);

export default app;

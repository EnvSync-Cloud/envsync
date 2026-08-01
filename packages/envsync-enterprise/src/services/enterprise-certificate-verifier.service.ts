import { createHash, createPrivateKey, createSign, createVerify, X509Certificate } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import "reflect-metadata";
import * as x509 from "@peculiar/x509";

import { config } from "@/utils/env";

export const ENTERPRISE_CERT_METADATA_OID = "1.3.6.1.4.1.58708.1.1";
export const ENTERPRISE_CERT_EKU_OID = "1.3.6.1.4.1.58708.1.2";

export type EnterpriseLicenseCertificateBundle = {
	version: 1;
	certificate_pem: string;
	private_key_pem: string;
	root_ca_pem?: string;
	serial_hex: string;
	issued_at: string;
	expires_at: string;
	metadata: {
		edition: "enterprise";
		license_key_hash: string;
		install_fingerprint: string;
		root_domain?: string;
		stack_name?: string;
		release_version?: string;
		issuer: "envsync-license-server";
	};
};

export type CertificateValidationResult = {
	status: "active" | "locked" | "expired" | "error";
	reason_code: string | null;
	message: string;
	serial_hex: string | null;
	certificate_fingerprint_sha256: string | null;
	root_ca_fingerprint_sha256: string | null;
	expires_at: Date | null;
	subject: string | null;
	issuer: string | null;
};

function sha256Hex(value: Buffer | string) {
	return createHash("sha256").update(value).digest("hex");
}

function readIfExists(filePath?: string) {
	if (!filePath) return null;
	return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
}

function bundledRootCaPem() {
	// PEM still ships with envsync-api assets (H3); verifier lives in envsync-enterprise.
	return fs.readFileSync(
		path.join(import.meta.dir, "../../../envsync-api/src/assets/license/envsync-enterprise-root-ca.pem"),
		"utf8",
	);
}

function loadRootCaPem() {
	return config.ENVSYNC_LICENSE_ROOT_CA_CERT_PEM
		|| readIfExists(config.ENVSYNC_LICENSE_ROOT_CA_CERT_PATH)
		|| bundledRootCaPem();
}

function loadBundleFromEnv(): EnterpriseLicenseCertificateBundle {
	if (config.ENVSYNC_LICENSE_BUNDLE_PATH) {
		const raw = readIfExists(config.ENVSYNC_LICENSE_BUNDLE_PATH);
		if (!raw) throw new Error(`License bundle not found at ${config.ENVSYNC_LICENSE_BUNDLE_PATH}`);
		return JSON.parse(raw) as EnterpriseLicenseCertificateBundle;
	}

	const certificatePem = readIfExists(config.ENVSYNC_LICENSE_CERT_PATH);
	const privateKeyPem = readIfExists(config.ENVSYNC_LICENSE_KEY_PATH);
	if (!certificatePem || !privateKeyPem) {
		throw new Error("Enterprise certificate bundle is not configured.");
	}

	return {
		version: 1,
		certificate_pem: certificatePem,
		private_key_pem: privateKeyPem,
		serial_hex: "",
		issued_at: "",
		expires_at: "",
		metadata: {
			edition: "enterprise",
			license_key_hash: "",
			install_fingerprint: config.ENVSYNC_INSTALL_FINGERPRINT ?? "",
			issuer: "envsync-license-server",
		},
	};
}

function parseMetadata(certificatePem: string) {
	const cert = new x509.X509Certificate(certificatePem);
	const extension = cert.getExtension(ENTERPRISE_CERT_METADATA_OID);
	if (!extension) throw new Error("Enterprise certificate metadata extension is missing.");
	const text = new TextDecoder().decode(extension.value);
	return JSON.parse(text) as EnterpriseLicenseCertificateBundle["metadata"];
}

function provePrivateKey(certificate: X509Certificate, privateKeyPem: string) {
	const challenge = `envsync-enterprise-license:${certificate.serialNumber}:${certificate.fingerprint256}`;
	const privateKey = createPrivateKey(privateKeyPem);
	const signer = createSign("sha256");
	signer.update(challenge);
	signer.end();
	const signature = signer.sign(privateKey);
	const verifier = createVerify("sha256");
	verifier.update(challenge);
	verifier.end();
	return verifier.verify(certificate.publicKey, signature);
}

export class EnterpriseCertificateVerifierService {
	public static async validateFromEnv() {
		return this.validateBundle(loadBundleFromEnv(), { rootCaPem: loadRootCaPem() });
	}

	public static async validateBundle(
		bundle: EnterpriseLicenseCertificateBundle,
		options: { rootCaPem?: string } = {},
	): Promise<CertificateValidationResult> {
		try {
			const rootCaPem = options.rootCaPem || loadRootCaPem();
			const root = new X509Certificate(rootCaPem);
			const certificate = new X509Certificate(bundle.certificate_pem);
			const now = Date.now();
			const validFrom = new Date(certificate.validFrom).getTime();
			const validTo = new Date(certificate.validTo).getTime();
			const serialHex = certificate.serialNumber.toLowerCase();
			const certificateFingerprint = sha256Hex(certificate.raw);
			const rootFingerprint = sha256Hex(root.raw);

			if (validFrom > now) {
				return {
					status: "locked",
					reason_code: "LICENSE_CERT_NOT_YET_VALID",
					message: "Enterprise certificate is not valid yet.",
					serial_hex: serialHex,
					certificate_fingerprint_sha256: certificateFingerprint,
					root_ca_fingerprint_sha256: rootFingerprint,
					expires_at: new Date(certificate.validTo),
					subject: certificate.subject,
					issuer: certificate.issuer,
				};
			}

			if (validTo <= now) {
				return {
					status: "expired",
					reason_code: "LICENSE_CERT_EXPIRED",
					message: "Enterprise certificate has expired.",
					serial_hex: serialHex,
					certificate_fingerprint_sha256: certificateFingerprint,
					root_ca_fingerprint_sha256: rootFingerprint,
					expires_at: new Date(certificate.validTo),
					subject: certificate.subject,
					issuer: certificate.issuer,
				};
			}

			if (!certificate.verify(root.publicKey)) {
				return {
					status: "locked",
					reason_code: "LICENSE_CERT_INVALID_CHAIN",
					message: "Enterprise certificate is not signed by the trusted Root CA.",
					serial_hex: serialHex,
					certificate_fingerprint_sha256: certificateFingerprint,
					root_ca_fingerprint_sha256: rootFingerprint,
					expires_at: new Date(certificate.validTo),
					subject: certificate.subject,
					issuer: certificate.issuer,
				};
			}

			const metadata = parseMetadata(bundle.certificate_pem);
			if (metadata.edition !== "enterprise" || metadata.install_fingerprint !== (config.ENVSYNC_INSTALL_FINGERPRINT ?? "")) {
				return {
					status: "locked",
					reason_code: "LICENSE_CERT_METADATA_MISMATCH",
					message: "Enterprise certificate metadata does not match this installation.",
					serial_hex: serialHex,
					certificate_fingerprint_sha256: certificateFingerprint,
					root_ca_fingerprint_sha256: rootFingerprint,
					expires_at: new Date(certificate.validTo),
					subject: certificate.subject,
					issuer: certificate.issuer,
				};
			}

			if (metadata.stack_name && config.ENVSYNC_STACK_NAME && metadata.stack_name !== config.ENVSYNC_STACK_NAME) {
				return {
					status: "locked",
					reason_code: "LICENSE_CERT_METADATA_MISMATCH",
					message: "Enterprise certificate stack name does not match this installation.",
					serial_hex: serialHex,
					certificate_fingerprint_sha256: certificateFingerprint,
					root_ca_fingerprint_sha256: rootFingerprint,
					expires_at: new Date(certificate.validTo),
					subject: certificate.subject,
					issuer: certificate.issuer,
				};
			}

			if (!provePrivateKey(certificate, bundle.private_key_pem)) {
				return {
					status: "locked",
					reason_code: "LICENSE_CERT_KEY_MISMATCH",
					message: "Enterprise certificate private key does not match the certificate.",
					serial_hex: serialHex,
					certificate_fingerprint_sha256: certificateFingerprint,
					root_ca_fingerprint_sha256: rootFingerprint,
					expires_at: new Date(certificate.validTo),
					subject: certificate.subject,
					issuer: certificate.issuer,
				};
			}

			return {
				status: "active",
				reason_code: null,
				message: "Enterprise certificate validated.",
				serial_hex: serialHex,
				certificate_fingerprint_sha256: certificateFingerprint,
				root_ca_fingerprint_sha256: rootFingerprint,
				expires_at: new Date(certificate.validTo),
				subject: certificate.subject,
				issuer: certificate.issuer,
			};
		} catch (error) {
			return {
				status: "error",
				reason_code: "LICENSE_CERT_UNREADABLE",
				message: error instanceof Error ? error.message : String(error),
				serial_hex: null,
				certificate_fingerprint_sha256: null,
				root_ca_fingerprint_sha256: null,
				expires_at: null,
				subject: null,
				issuer: null,
			};
		}
	}
}

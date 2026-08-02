import { config } from "@/utils/env";

export interface LicenseVerificationRequest {
	license_key: string;
	install_fingerprint: string;
	edition: "oss" | "enterprise";
	root_domain?: string;
	stack_name?: string;
	release_version?: string;
	requested_validity_days?: number;
}

export interface EnterpriseLicenseCertificateBundle {
	version: 1;
	certificate_pem: string;
	private_key_pem: string;
	root_ca_pem?: string;
	serial_hex: string;
	certificate_fingerprint_sha256: string;
	root_ca_fingerprint_sha256: string;
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
}

export interface LicenseVerificationResponse {
	status: "active" | "inactive" | "expired" | "error" | "locked";
	lease_expires_at?: string | null;
	/** Entitlement JWT (EdDSA preferred) or legacy opaque lease */
	signed_lease?: string | null;
	/** Present when license-server H4+ issues EdDSA entitlement JWTs */
	entitlement_alg?: "EdDSA" | "HS256" | string | null;
	reason_code?: string | null;
	message?: string | null;
	license_key?: string | null;
	activated_at?: string | null;
	last_verified_at?: string | null;
	bundle?: EnterpriseLicenseCertificateBundle;
}

async function postLicense(path: string, body: LicenseVerificationRequest, serverUrl = config.ENVSYNC_LICENSE_SERVER_URL) {
	if (!serverUrl) {
		throw new Error("ENVSYNC_LICENSE_SERVER_URL is not configured.");
	}

	const response = await fetch(`${serverUrl.replace(/\/$/, "")}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) {
		const body = await response.json().catch(() => null) as { message?: string } | null;
		throw new Error(body?.message || `License server request failed (${response.status})`);
	}

	return response.json() as Promise<LicenseVerificationResponse>;
}

export class LicenseServerClient {
	public static activate(body: LicenseVerificationRequest, serverUrl?: string) {
		return postLicense("/v1/activate", body, serverUrl);
	}

	public static verify(body: LicenseVerificationRequest, serverUrl?: string) {
		return postLicense("/v1/verify", body, serverUrl);
	}

	public static issueCertificate(body: LicenseVerificationRequest, serverUrl?: string) {
		return postLicense("/v1/certificates/issue", body, serverUrl);
	}

	public static renewCertificate(body: LicenseVerificationRequest, serverUrl?: string) {
		return postLicense("/v1/certificates/renew", body, serverUrl);
	}
}

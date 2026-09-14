/**
 * OSS-safe loader. The real verifier lives in envsync-enterprise.
 * Do not `export *` that package — the OSS image does not copy it.
 */
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

type EnterpriseVerifier = {
	EnterpriseCertificateVerifierService: {
		validateFromEnv: () => Promise<CertificateValidationResult>;
	};
};

const MISSING_EE_RESULT: CertificateValidationResult = {
	status: "error",
	reason_code: "ENTERPRISE_PACKAGE_MISSING",
	message: "Certificate verification requires the enterprise package.",
	serial_hex: null,
	certificate_fingerprint_sha256: null,
	root_ca_fingerprint_sha256: null,
	expires_at: null,
	subject: null,
	issuer: null,
};

export class EnterpriseCertificateVerifierService {
	public static async validateFromEnv(): Promise<CertificateValidationResult> {
		try {
			const { EnterpriseCertificateVerifierService: EnterpriseVerifier } = (await import(
				"../../../envsync-enterprise/src/services/enterprise-certificate-verifier.service.ts"
			)) as EnterpriseVerifier;
			return EnterpriseVerifier.validateFromEnv();
		} catch {
			return MISSING_EE_RESULT;
		}
	}
}

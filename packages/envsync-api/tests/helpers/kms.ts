/**
 * Mock KMS client for unit tests.
 * Performs real AES-256-GCM encryption/decryption using Node.js crypto,
 * ensuring correct roundtrip behavior without requiring a running miniKMS server.
 */
import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	randomUUID,
} from "node:crypto";

/**
 * Derive a deterministic 256-bit key from org+app IDs (test-only).
 * NOT cryptographically meaningful — just ensures consistent encrypt/decrypt.
 */
function deriveTestKey(orgId: string, appId: string): Buffer {
	return createHash("sha256")
		.update(`mock-kms-key:${orgId}:${appId}`)
		.digest();
}

/**
 * In-memory store for key version IDs → metadata.
 * Allows the mock to track which key was used for encryption.
 */
const keyVersionStore = new Map<string, { orgId: string; appId: string }>();

// ── PKI in-memory state ─────────────────────────────────────────────

interface PKICert {
	serialHex: string;
	orgId: string;
	certType: "org_ca" | "member";
	revoked: boolean;
	revokedAt: string;
}

const orgCAs = new Map<string, { certPem: string; serialHex: string }>();
const pkiCerts = new Map<string, PKICert>();

function nextSerial(): string {
	return randomBytes(8).toString("hex");
}

const MOCK_ROOT_CA_PEM =
	"-----BEGIN CERTIFICATE-----\nMOCKROOTCA\n-----END CERTIFICATE-----";

function mockCertPem(cn: string): string {
	return `-----BEGIN CERTIFICATE-----\nMOCK-CERT:${cn}\n-----END CERTIFICATE-----`;
}

function mockKeyPem(): string {
	return `-----BEGIN EC PRIVATE KEY-----\nMOCK-KEY-${randomUUID().slice(0, 8)}\n-----END EC PRIVATE KEY-----`;
}

/** Reset all PKI state between tests */
export function resetPKI(): void {
	orgCAs.clear();
	pkiCerts.clear();
}

export const MockKMSClient = {
	async encrypt(
		orgId: string,
		appId: string,
		plaintext: string,
		aad: string,
	): Promise<{ ciphertext: string; keyVersionId: string }> {
		const key = deriveTestKey(orgId, appId);
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", key, iv);
		cipher.setAAD(Buffer.from(aad, "utf-8"));

		const encrypted = Buffer.concat([
			cipher.update(plaintext, "utf-8"),
			cipher.final(),
		]);
		const authTag = cipher.getAuthTag();

		// Format: iv(12) + authTag(16) + ciphertext
		const combined = Buffer.concat([iv, authTag, encrypted]);
		const ciphertext = combined.toString("base64");

		const keyVersionId = `mock-v1-${randomUUID().slice(0, 8)}`;
		keyVersionStore.set(keyVersionId, { orgId, appId });

		return { ciphertext, keyVersionId };
	},

	async decrypt(
		orgId: string,
		appId: string,
		ciphertext: string,
		aad: string,
		_keyVersionId: string,
	): Promise<{ plaintext: string }> {
		const key = deriveTestKey(orgId, appId);
		const combined = Buffer.from(ciphertext, "base64");

		const iv = combined.subarray(0, 12);
		const authTag = combined.subarray(12, 28);
		const encrypted = combined.subarray(28);

		const decipher = createDecipheriv("aes-256-gcm", key, iv);
		decipher.setAAD(Buffer.from(aad, "utf-8"));
		decipher.setAuthTag(authTag);

		const decrypted = Buffer.concat([
			decipher.update(encrypted),
			decipher.final(),
		]);

		return { plaintext: decrypted.toString("utf-8") };
	},

	async batchEncrypt(
		orgId: string,
		appId: string,
		items: { plaintext: string; aad: string }[],
	): Promise<{ ciphertext: string; keyVersionId: string }[]> {
		return Promise.all(
			items.map((item) => this.encrypt(orgId, appId, item.plaintext, item.aad)),
		);
	},

	async batchDecrypt(
		orgId: string,
		appId: string,
		items: { ciphertext: string; aad: string; keyVersionId: string }[],
	): Promise<{ plaintext: string }[]> {
		return Promise.all(
			items.map((item) =>
				this.decrypt(orgId, appId, item.ciphertext, item.aad, item.keyVersionId),
			),
		);
	},

	async healthCheck(): Promise<boolean> {
		return true;
	},

	// ─── PKI mock methods ────────────────────────────────────────────

	async createOrgCA(
		orgId: string,
		orgName: string,
	): Promise<{ certPem: string; serialHex: string }> {
		if (orgCAs.has(orgId)) {
			throw new Error("Org CA already exists for this org");
		}
		const serialHex = nextSerial();
		const certPem = mockCertPem(`${orgName} CA`);
		orgCAs.set(orgId, { certPem, serialHex });
		pkiCerts.set(serialHex, {
			serialHex,
			orgId,
			certType: "org_ca",
			revoked: false,
			revokedAt: "",
		});
		return { certPem, serialHex };
	},

	async issueMemberCert(
		memberId: string,
		memberEmail: string,
		orgId: string,
		_role: string,
	): Promise<{ certPem: string; keyPem: string; serialHex: string }> {
		if (!orgCAs.has(orgId)) {
			throw new Error("Org CA not initialized");
		}
		const serialHex = nextSerial();
		const certPem = mockCertPem(memberEmail);
		const keyPem = mockKeyPem();
		pkiCerts.set(serialHex, {
			serialHex,
			orgId,
			certType: "member",
			revoked: false,
			revokedAt: "",
		});
		return { certPem, keyPem, serialHex };
	},

	async revokeCert(
		serialHex: string,
		orgId: string,
		_reason: number,
	): Promise<{ success: boolean }> {
		const cert = pkiCerts.get(serialHex);
		if (!cert || cert.orgId !== orgId) {
			throw new Error("Certificate not found");
		}
		cert.revoked = true;
		cert.revokedAt = new Date().toISOString();
		return { success: true };
	},

	async getCRL(
		orgId: string,
		deltaOnly: boolean,
	): Promise<{ crlDer: Buffer; crlNumber: number; isDelta: boolean }> {
		// Return a fake DER buffer that, when base64-encoded, is a recognisable placeholder
		const fakeDer = Buffer.from("MOCK-CRL-DER-DATA");
		return { crlDer: fakeDer, crlNumber: 1, isDelta: deltaOnly };
	},

	async checkOCSP(
		serialHex: string,
		orgId: string,
	): Promise<{ status: number; revokedAt: string }> {
		const cert = pkiCerts.get(serialHex);
		if (!cert || cert.orgId !== orgId) {
			return { status: 2, revokedAt: "" }; // unknown
		}
		if (cert.revoked) {
			return { status: 1, revokedAt: cert.revokedAt }; // revoked
		}
		return { status: 0, revokedAt: "" }; // good
	},

	async getRootCA(): Promise<{ certPem: string }> {
		return { certPem: MOCK_ROOT_CA_PEM };
	},
};

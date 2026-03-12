/**
 * Mock KMS client for unit tests.
 * Performs real AES-256-GCM encryption/decryption using Node.js crypto,
 * ensuring correct roundtrip behavior without requiring a running miniKMS server.
 *
 * Also provides in-memory VaultService and SessionService mocks.
 */
import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	randomUUID,
} from "node:crypto";

import type {
	VaultWriteRequest,
	VaultWriteResult,
	VaultReadRequest,
	VaultReadResult,
	VaultListEntry,
	VaultVersionEntry,
	CreateSessionManagedRequest,
	CreateSessionResult,
	ValidateSessionResult,
} from "@/libs/kms/client";

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

// ── Vault service in-memory state ───────────────────────────────────

const vaultStore = new Map<string, { value: Buffer; version: number; createdBy: string; createdAt: number }>();

function vaultKey(orgId: string, scopeId: string, entryType: string, key: string, envTypeId?: string): string {
	return `${orgId}:${scopeId}:${entryType}:${envTypeId || ""}:${key}`;
}

/** Reset all in-memory vault data between tests */
export function resetVaultStore(): void {
	vaultStore.clear();
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

	// ─── Vault service mock methods ─────────────────────────────────

	async vaultWrite(req: VaultWriteRequest, _sessionToken: string): Promise<VaultWriteResult> {
		const k = vaultKey(req.orgId, req.scopeId, req.entryType, req.key, req.envTypeId);
		const existing = vaultStore.get(k);
		const version = (existing?.version || 0) + 1;
		vaultStore.set(k, { value: req.value, version, createdBy: req.createdBy, createdAt: Date.now() });
		return { id: `mock-${k}-v${version}`, version, keyVersionId: `mock-kv-${randomUUID().slice(0, 8)}` };
	},

	async vaultRead(req: VaultReadRequest, _sessionToken: string): Promise<VaultReadResult> {
		const k = vaultKey(req.orgId, req.scopeId, req.entryType, req.key, req.envTypeId);
		const entry = vaultStore.get(k);
		if (!entry) {
			const err = new Error("NOT_FOUND") as any;
			err.code = 5; // gRPC NOT_FOUND
			throw err;
		}
		return {
			id: `mock-${k}`, orgId: req.orgId, scopeId: req.scopeId, entryType: req.entryType,
			key: req.key, envTypeId: req.envTypeId, encryptedValue: entry.value,
			keyVersionId: "mock-kv", version: entry.version,
			createdAt: String(Math.floor(entry.createdAt / 1000)), createdBy: entry.createdBy,
		};
	},

	async vaultDelete(
		_orgId: string,
		_scopeId: string,
		_entryType: string,
		_key: string,
		_envTypeId: string | undefined,
		_sessionToken: string,
	): Promise<boolean> {
		return true;
	},

	async vaultDestroy(
		orgId: string,
		scopeId: string,
		entryType: string,
		key: string,
		envTypeId: string | undefined,
		_version: number,
		_sessionToken: string,
	): Promise<number> {
		const k = vaultKey(orgId, scopeId, entryType, key, envTypeId);
		return vaultStore.delete(k) ? 1 : 0;
	},

	async vaultList(
		orgId: string,
		scopeId: string,
		entryType: string,
		envTypeId: string | undefined,
		_sessionToken: string,
	): Promise<VaultListEntry[]> {
		const prefix = `${orgId}:${scopeId}:${entryType}:${envTypeId || ""}:`;
		const entries: VaultListEntry[] = [];
		for (const [k, v] of vaultStore) {
			if (k.startsWith(prefix)) {
				const key = k.slice(prefix.length);
				entries.push({ key, latestVersion: v.version, createdAt: String(v.createdAt), updatedAt: String(v.createdAt) });
			}
		}
		return entries;
	},

	async vaultHistory(
		_orgId: string,
		_scopeId: string,
		_entryType: string,
		_key: string,
		_envTypeId: string | undefined,
		_sessionToken: string,
	): Promise<VaultVersionEntry[]> {
		return [];
	},

	// ─── Session service mock methods ───────────────────────────────

	async createSessionManaged(req: CreateSessionManagedRequest): Promise<CreateSessionResult> {
		return {
			sessionToken: `mock-session-${req.memberId}-${req.orgId}`,
			expiresAt: String(Math.floor(Date.now() / 1000) + 3600),
			scopes: [],
		};
	},

	async validateSession(_token: string): Promise<ValidateSessionResult> {
		return { valid: true, memberId: "mock", orgId: "mock", role: "admin", certSerial: "mock", scopes: [], expiresAt: "" };
	},

	async revokeSession(_token: string): Promise<boolean> {
		return true;
	},

	async revokeMemberSessions(_memberId: string, _orgId: string): Promise<number> {
		return 0;
	},
};

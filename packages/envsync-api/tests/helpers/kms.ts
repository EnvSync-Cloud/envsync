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
};

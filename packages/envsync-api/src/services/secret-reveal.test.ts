import { describe, expect, test } from "bun:test";

import { generateKeyPair, smartEncrypt } from "@/helpers/key-store";

import { revealSecretValue } from "./secret.service";

describe("revealSecretValue", () => {
	test("returns a stored plaintext value unchanged", () => {
		expect(revealSecretValue("DATABASE_URL", "postgres://localhost/app", "unused")).toBe(
			"postgres://localhost/app",
		);
	});

	test("decrypts an RSA value with the app private key", () => {
		const { publicKey, privateKey } = generateKeyPair();
		const stored = smartEncrypt("sk_live_example", publicKey);
		expect(stored.startsWith("RSA:")).toBe(true);
		expect(revealSecretValue("API_KEY", stored, privateKey)).toBe("sk_live_example");
	});

	test("decrypts a hybrid-encrypted value too large for an RSA block", () => {
		const { publicKey, privateKey } = generateKeyPair();
		const value = "example-value-".repeat(100);
		const stored = smartEncrypt(value, publicKey);
		expect(stored.startsWith("HYB:")).toBe(true);
		expect(revealSecretValue("CERTIFICATE", stored, privateKey)).toBe(value);
	});

	test.each(["RSA:", "HYB:"])("rejects malformed %s ciphertext as a decryption conflict", prefix => {
		expect(() => revealSecretValue("API_KEY", prefix + "invalid", "unused")).toThrow(
			expect.objectContaining({
				code: "SECRET_DECRYPT_FAILED",
				statusCode: 409,
				message: "Failed to decrypt secret API_KEY.",
			}),
		);
	});
});

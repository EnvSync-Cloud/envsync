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
});

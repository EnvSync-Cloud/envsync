import { generateKeyPairSync } from "node:crypto";

/**
 * Generate an RSA-3072 key pair for app BYOK key generation.
 * Extracted from the old key-store.ts — no KMS/Vault dependency.
 */
export const generateKeyPair = () => {
	const { publicKey, privateKey } = generateKeyPairSync("rsa", {
		modulusLength: 3072,
		publicKeyEncoding: {
			type: "spki",
			format: "pem",
		},
		privateKeyEncoding: {
			type: "pkcs8",
			format: "pem",
		},
	});

	return { publicKey, privateKey };
};

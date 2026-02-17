import {
	generateKeyPairSync,
	publicEncrypt,
	privateDecrypt,
	createCipheriv,
	createDecipheriv,
	randomBytes,
	constants,
} from "node:crypto";

import { KMSClient } from "@/libs/kms/client";

// Generate RSA key pair with optimized settings
export const generateKeyPair = () => {
	const { publicKey, privateKey } = generateKeyPairSync("rsa", {
		modulusLength: 3072, // Reduced from 4096 for better performance, still very secure
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

const hybridEncrypt = (data: string, publicKey: string): string => {
	// Generate smaller AES key (24 bytes for AES-192, still very secure)
	const aesKey = randomBytes(24);

	// Generate 12-byte IV for GCM mode (smaller than CBC's 16 bytes)
	const iv = randomBytes(12);

	// Use AES-192-GCM for authenticated encryption (faster than AES-256, smaller IV)
	const cipher = createCipheriv("aes-192-gcm", aesKey, iv);

	// Encrypt data
	const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);

	// Get authentication tag (16 bytes)
	const authTag = cipher.getAuthTag();

	// Encrypt the AES key with RSA using OAEP padding
	const encryptedAESKey = publicEncrypt(
		{
			key: publicKey,
			padding: constants.RSA_PKCS1_OAEP_PADDING,
			oaepHash: "sha256",
		},
		aesKey,
	);

	// Pack everything efficiently: encryptedKey(2 bytes length) + key + iv(12) + authTag(16) + data
	const keyLength = Buffer.alloc(2);
	keyLength.writeUInt16BE(encryptedAESKey.length, 0);

	const result = Buffer.concat([
		keyLength, // 2 bytes
		encryptedAESKey, // ~384 bytes (3072-bit RSA with OAEP)
		iv, // 12 bytes
		authTag, // 16 bytes
		encrypted, // variable
	]);

	return result.toString("base64");
};

const hybridDecrypt = (encryptedData: string, privateKey: string): string => {
	const data = Buffer.from(encryptedData, "base64");

	// Extract components efficiently
	const keyLength = data.readUInt16BE(0);
	let offset = 2;

	const encryptedAESKey = data.subarray(offset, offset + keyLength);
	offset += keyLength;

	const iv = data.subarray(offset, offset + 12);
	offset += 12;

	const authTag = data.subarray(offset, offset + 16);
	offset += 16;

	const encrypted = data.subarray(offset);

	// Decrypt the AES key using RSA private key with OAEP padding
	const aesKey = privateDecrypt(
		{
			key: privateKey,
			padding: constants.RSA_PKCS1_OAEP_PADDING,
			oaepHash: "sha256",
		},
		encryptedAESKey,
	);

	// Decrypt the data using AES-192-GCM
	const decipher = createDecipheriv("aes-192-gcm", aesKey, iv);
	decipher.setAuthTag(authTag);

	const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

	return decrypted.toString("utf8");
};

// Optimized version for very small data (< 190 bytes with 3072-bit RSA + OAEP)
const rsaEncryptSmall = (data: string, publicKey: string): string => {
	const buffer = Buffer.from(data, "utf8");

	// Check size limit for direct RSA encryption with OAEP padding
	if (buffer.length > 190) {
		// 3072/8 - 2*32 - 2 (OAEP overhead) - margin
		throw new Error("Data too large for direct RSA encryption. Use hybridEncrypt instead.");
	}

	const encrypted = publicEncrypt(
		{
			key: publicKey,
			padding: constants.RSA_PKCS1_OAEP_PADDING,
			oaepHash: "sha256",
		},
		buffer,
	);

	return encrypted.toString("base64");
};

const rsaDecryptSmall = (encryptedData: string, privateKey: string): string => {
	const decrypted = privateDecrypt(
		{
			key: privateKey,
			padding: constants.RSA_PKCS1_OAEP_PADDING,
			oaepHash: "sha256",
		},
		Buffer.from(encryptedData, "base64"),
	);

	return decrypted.toString("utf8");
};

/**
 * Encrypt data using the app's RSA/BYOK public key.
 * Used as the inner encryption layer for secrets (BYOK/PKI layer).
 * Returns prefixed ciphertext: "RSA:{base64}" or "HYB:{base64}"
 */
export const smartEncrypt = (data: string, publicKey: string): string => {
	const dataSize = Buffer.byteLength(data, "utf8");

	// Use direct RSA for small data (faster, smaller output)
	if (dataSize <= 150) {
		// Safe margin for OAEP
		return "RSA:" + rsaEncryptSmall(data, publicKey);
	}

	// Use hybrid for larger data
	return "HYB:" + hybridEncrypt(data, publicKey);
};

/**
 * Encrypt a value using miniKMS. This is the preferred encryption method.
 * Returns a formatted string: KMS:v1:{keyVersionId}:{base64_ciphertext}
 */
export const kmsEncrypt = async (
	orgId: string,
	appId: string,
	value: string,
	aad: string,
): Promise<string> => {
	const kms = await KMSClient.getInstance();
	const { ciphertext, keyVersionId } = await kms.encrypt(orgId, appId, value, aad);
	return `KMS:v1:${keyVersionId}:${ciphertext}`;
};

/**
 * Decrypt a KMS-encrypted value. Parses the KMS:v1: format and calls miniKMS.
 * Returns the inner plaintext (which may itself be RSA:/HYB: encrypted for secrets).
 * AAD must match the value used during encryption.
 */
export const kmsDecrypt = async (
	orgId: string,
	appId: string,
	kmsWrapped: string,
	aad: string,
): Promise<string> => {
	if (!kmsWrapped.startsWith("KMS:v1:")) {
		throw new Error("Not a KMS:v1: encrypted value");
	}

	const parts = kmsWrapped.substring(7).split(":");
	if (parts.length < 2) {
		throw new Error("Invalid KMS:v1: format");
	}
	const keyVersionId = parts[0];
	const ciphertext = parts.slice(1).join(":");

	const kms = await KMSClient.getInstance();
	const result = await kms.decrypt(orgId, appId, ciphertext, aad, keyVersionId);
	return result.plaintext;
};

/**
 * Decrypt the inner RSA/BYOK encryption layer.
 * Only works with RSA: and HYB: prefixed data.
 * Used as Layer 2 decryption after KMS-unwrapping.
 */
export const rsaLayerDecrypt = (encryptedData: string, privateKey: string): string => {
	const method = encryptedData.substring(0, 4);
	const data = encryptedData.substring(4);

	if (method === "RSA:") {
		return rsaDecryptSmall(data, privateKey);
	} else if (method === "HYB:") {
		return hybridDecrypt(data, privateKey);
	} else {
		throw new Error("Unknown encryption method");
	}
};

import { v4 as uuidv4 } from "uuid";
import * as openpgp from "openpgp";

import { DB, JsonValue } from "@/libs/db";
import { VaultClient } from "@/libs/vault";
import { KMSClient } from "@/libs/kms/client";
import { gpgKeyPath } from "@/libs/vault/paths";
import { randomBytes } from "node:crypto";

type GpgAlgorithm = "rsa" | "ecc-curve25519" | "ecc-p256" | "ecc-p384";

function algorithmToOpenPGP(algorithm: GpgAlgorithm, keySize?: number) {
	switch (algorithm) {
		case "rsa":
			return { type: "rsa" as const, rsaBits: keySize || 4096 };
		case "ecc-curve25519":
			return { type: "ecc" as const, curve: "curve25519" as const };
		case "ecc-p256":
			return { type: "ecc" as const, curve: "p256" as const };
		case "ecc-p384":
			return { type: "ecc" as const, curve: "p384" as const };
	}
}

export class GpgKeyService {
	public static generateKey = async ({
		org_id,
		user_id,
		name,
		email,
		algorithm,
		key_size,
		usage_flags,
		expires_in_days,
		is_default,
	}: {
		org_id: string;
		user_id: string;
		name: string;
		email: string;
		algorithm: GpgAlgorithm;
		key_size?: number;
		usage_flags: string[];
		expires_in_days?: number;
		is_default?: boolean;
	}) => {
		const passphrase = randomBytes(32).toString("hex");

		const keyOptions: any = {
			type: algorithmToOpenPGP(algorithm, key_size).type,
			userIDs: [{ name, email }],
			passphrase,
			format: "armored" as const,
		};

		if (algorithm === "rsa") {
			keyOptions.rsaBits = key_size || 4096;
		} else {
			keyOptions.curve = algorithmToOpenPGP(algorithm).curve;
		}

		const { privateKey, publicKey } = await openpgp.generateKey(keyOptions);

		const parsedPublic = await openpgp.readKey({ armoredKey: publicKey });
		const fingerprint = parsedPublic.getFingerprint().toUpperCase();
		const keyId = fingerprint.slice(-16);

		// KMS-encrypt the passphrase
		const kms = await KMSClient.getInstance();
		const kmsResult = await kms.encrypt(org_id, "gpg", passphrase, `gpg:${fingerprint}`);

		// Store private key + encrypted passphrase in Vault
		const vault = await VaultClient.getInstance();
		const vaultPath = gpgKeyPath(org_id, fingerprint);
		await vault.kvWrite(vaultPath, {
			armored_private_key: privateKey,
			kms_wrapped_passphrase: kmsResult.ciphertext,
			kms_key_version_id: kmsResult.keyVersionId,
		});

		const db = await DB.getInstance();

		// If setting as default, unset other defaults in the org
		if (is_default) {
			await db
				.updateTable("gpg_keys")
				.set({ is_default: false, updated_at: new Date() })
				.where("org_id", "=", org_id)
				.where("is_default", "=", true)
				.execute();
		}

		const now = new Date();
		const expiresAt = expires_in_days
			? new Date(now.getTime() + expires_in_days * 24 * 60 * 60 * 1000)
			: null;

		const gpgKey = await db
			.insertInto("gpg_keys")
			.values({
				id: uuidv4(),
				org_id,
				user_id,
				name,
				email,
				fingerprint,
				key_id: keyId,
				algorithm,
				key_size: algorithm === "rsa" ? (key_size || 4096) : null,
				public_key: publicKey,
				private_key_ref: vaultPath,
				usage_flags: new JsonValue(usage_flags),
				trust_level: "ultimate",
				expires_at: expiresAt,
				is_default: is_default || false,
				created_at: now,
				updated_at: now,
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		return gpgKey;
	};

	public static importKey = async ({
		org_id,
		user_id,
		name,
		armored_public_key,
		armored_private_key,
		passphrase,
	}: {
		org_id: string;
		user_id: string;
		name: string;
		armored_public_key: string;
		armored_private_key?: string;
		passphrase?: string;
	}) => {
		const parsedPublic = await openpgp.readKey({ armoredKey: armored_public_key });
		const fingerprint = parsedPublic.getFingerprint().toUpperCase();
		const keyId = fingerprint.slice(-16);

		const primaryUser = await parsedPublic.getPrimaryUser();
		const email = primaryUser.user.userID?.email || "";

		const algorithmInfo = parsedPublic.getAlgorithmInfo();
		let algorithm: string;
		let keySize: number | null = null;
		if (algorithmInfo.algorithm === "rsaEncryptSign" || algorithmInfo.algorithm === "rsaSign") {
			algorithm = "rsa";
			keySize = (algorithmInfo as any).bits || null;
		} else {
			const curve = (algorithmInfo as any).curve || "curve25519";
			algorithm = `ecc-${curve}`;
		}

		let vaultPath = "";
		if (armored_private_key) {
			const newPassphrase = randomBytes(32).toString("hex");

			// Decrypt the original private key
			let decryptedKey: openpgp.PrivateKey;
			if (passphrase) {
				decryptedKey = await openpgp.decryptKey({
					privateKey: await openpgp.readPrivateKey({ armoredKey: armored_private_key }),
					passphrase,
				});
			} else {
				decryptedKey = await openpgp.readPrivateKey({ armoredKey: armored_private_key });
			}

			// Re-encrypt with new passphrase
			const reEncrypted = await openpgp.encryptKey({
				privateKey: decryptedKey,
				passphrase: newPassphrase,
			});

			// KMS-encrypt the new passphrase
			const kms = await KMSClient.getInstance();
			const kmsResult = await kms.encrypt(org_id, "gpg", newPassphrase, `gpg:${fingerprint}`);

			// Store in Vault
			const vault = await VaultClient.getInstance();
			vaultPath = gpgKeyPath(org_id, fingerprint);
			await vault.kvWrite(vaultPath, {
				armored_private_key: reEncrypted.armor(),
				kms_wrapped_passphrase: kmsResult.ciphertext,
				kms_key_version_id: kmsResult.keyVersionId,
			});
		}

		const db = await DB.getInstance();
		const now = new Date();

		const gpgKey = await db
			.insertInto("gpg_keys")
			.values({
				id: uuidv4(),
				org_id,
				user_id,
				name,
				email,
				fingerprint,
				key_id: keyId,
				algorithm,
				key_size: keySize,
				public_key: armored_public_key,
				private_key_ref: vaultPath,
				usage_flags: new JsonValue(["sign", "encrypt"]),
				trust_level: "unknown",
				is_default: false,
				created_at: now,
				updated_at: now,
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		return gpgKey;
	};

	public static listKeys = async (org_id: string) => {
		const db = await DB.getInstance();
		return db
			.selectFrom("gpg_keys")
			.select([
				"id", "org_id", "user_id", "name", "email", "fingerprint",
				"key_id", "algorithm", "key_size", "usage_flags", "trust_level",
				"expires_at", "revoked_at", "is_default", "created_at", "updated_at",
			])
			.where("org_id", "=", org_id)
			.orderBy("created_at", "desc")
			.execute();
	};

	public static getKey = async (id: string, org_id: string) => {
		const db = await DB.getInstance();
		return db
			.selectFrom("gpg_keys")
			.selectAll()
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.executeTakeFirstOrThrow();
	};

	public static exportPublicKey = async (id: string, org_id: string) => {
		const key = await this.getKey(id, org_id);
		return {
			public_key: key.public_key,
			fingerprint: key.fingerprint,
		};
	};

	public static deleteKey = async (id: string, org_id: string) => {
		const db = await DB.getInstance();
		const key = await this.getKey(id, org_id);

		// Delete from Vault if private key exists
		if (key.private_key_ref) {
			const vault = await VaultClient.getInstance();
			await vault.kvMetadataDelete(key.private_key_ref);
		}

		await db
			.deleteFrom("gpg_keys")
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.executeTakeFirstOrThrow();
	};

	public static revokeKey = async (id: string, org_id: string, reason?: string) => {
		const db = await DB.getInstance();
		const now = new Date();

		await db
			.updateTable("gpg_keys")
			.set({
				revoked_at: now,
				revocation_reason: reason || null,
				updated_at: now,
			})
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.execute();

		return this.getKey(id, org_id);
	};

	public static updateTrustLevel = async (id: string, org_id: string, trust_level: string) => {
		const db = await DB.getInstance();

		await db
			.updateTable("gpg_keys")
			.set({
				trust_level,
				updated_at: new Date(),
			})
			.where("id", "=", id)
			.where("org_id", "=", org_id)
			.execute();

		return this.getKey(id, org_id);
	};

	public static signData = async (
		gpg_key_id: string,
		org_id: string,
		data: string,
		mode: "binary" | "text" | "clearsign",
		detached: boolean,
	) => {
		const key = await this.getKey(gpg_key_id, org_id);

		if (key.revoked_at) {
			throw new Error("Cannot sign with a revoked key");
		}
		if (!key.private_key_ref) {
			throw new Error("No private key available for signing");
		}

		// Retrieve private key from Vault
		const vault = await VaultClient.getInstance();
		const vaultData = await vault.kvRead(key.private_key_ref);
		if (!vaultData) {
			throw new Error("Private key not found in Vault");
		}

		const { armored_private_key, kms_wrapped_passphrase, kms_key_version_id } = vaultData.data;

		// KMS-decrypt the passphrase
		const kms = await KMSClient.getInstance();
		const { plaintext: passphrase } = await kms.decrypt(
			org_id,
			"gpg",
			kms_wrapped_passphrase,
			`gpg:${key.fingerprint}`,
			kms_key_version_id,
		);

		// Decrypt the private key
		const privateKey = await openpgp.decryptKey({
			privateKey: await openpgp.readPrivateKey({ armoredKey: armored_private_key }),
			passphrase,
		});

		const messageData = Buffer.from(data, "base64");

		let signature: string;

		if (mode === "clearsign") {
			const message = await openpgp.createCleartextMessage({ text: messageData.toString("utf-8") });
			signature = await openpgp.sign({
				message,
				signingKeys: privateKey,
				format: "armored",
			}) as string;
		} else {
			const message = mode === "text"
				? await openpgp.createMessage({ text: messageData.toString("utf-8") })
				: await openpgp.createMessage({ binary: messageData });

			if (detached) {
				signature = await openpgp.sign({
					message,
					signingKeys: privateKey,
					detached: true,
					format: "armored",
				}) as string;
			} else {
				signature = await openpgp.sign({
					message,
					signingKeys: privateKey,
					format: "armored",
				}) as string;
			}
		}

		return {
			signature,
			key_id: key.id,
			fingerprint: key.fingerprint,
		};
	};

	public static verifySignature = async (
		data: string,
		signatureArmored: string,
		gpg_key_id: string | undefined,
		org_id: string,
	) => {
		const db = await DB.getInstance();

		// Load public key(s) to verify against
		let publicKeys: openpgp.Key[];
		if (gpg_key_id) {
			const key = await this.getKey(gpg_key_id, org_id);
			publicKeys = [await openpgp.readKey({ armoredKey: key.public_key })];
		} else {
			// Try all org keys
			const keys = await this.listKeys(org_id);
			publicKeys = await Promise.all(
				keys.map(async (k) => {
					const fullKey = await this.getKey(k.id, org_id);
					return openpgp.readKey({ armoredKey: fullKey.public_key });
				}),
			);
		}

		if (publicKeys.length === 0) {
			return { valid: false, signer_fingerprint: null, signer_key_id: null };
		}

		try {
			const messageData = Buffer.from(data, "base64");

			// Try clearsign verification first
			let verification;
			try {
				const cleartextMessage = await openpgp.readCleartextMessage({ cleartextMessage: signatureArmored });
				verification = await openpgp.verify({
					message: cleartextMessage,
					verificationKeys: publicKeys,
				});
			} catch {
				// Try detached signature verification
				const message = await openpgp.createMessage({ binary: messageData });
				const signature = await openpgp.readSignature({ armoredSignature: signatureArmored });
				verification = await openpgp.verify({
					message,
					signature,
					verificationKeys: publicKeys,
				});
			}

			const { verified, keyID } = verification.signatures[0];
			await verified;

			const signerKeyId = keyID.toHex().toUpperCase();

			// Find matching key
			let signerFingerprint: string | null = null;
			let signerDbKeyId: string | null = null;
			if (gpg_key_id) {
				const key = await this.getKey(gpg_key_id, org_id);
				signerFingerprint = key.fingerprint;
				signerDbKeyId = key.id;
			} else {
				const keys = await db
					.selectFrom("gpg_keys")
					.select(["id", "fingerprint", "key_id"])
					.where("org_id", "=", org_id)
					.execute();
				const match = keys.find((k) => k.key_id === signerKeyId || k.fingerprint.endsWith(signerKeyId));
				if (match) {
					signerFingerprint = match.fingerprint;
					signerDbKeyId = match.id;
				}
			}

			return {
				valid: true,
				signer_fingerprint: signerFingerprint,
				signer_key_id: signerDbKeyId,
			};
		} catch {
			return { valid: false, signer_fingerprint: null, signer_key_id: null };
		}
	};
}

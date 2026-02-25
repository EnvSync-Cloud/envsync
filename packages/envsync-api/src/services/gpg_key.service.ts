import * as openpgp from "openpgp";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { NotFoundError, BusinessRuleError } from "@/libs/errors";
import { STDBClient } from "@/libs/stdb";
import { runSaga } from "@/helpers/saga";
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

interface GpgKeyMetaRow {
	uuid: string;
	org_id: string;
	user_id: string;
	name: string;
	email: string;
	fingerprint: string;
	key_id: string;
	algorithm: string;
	key_size: number | null;
	public_key: string;
	private_key_ref: string;
	usage_flags: string;
	trust_level: string;
	expires_at: string | null;
	revoked_at: string | null;
	revocation_reason: string | null;
	is_default: boolean;
	created_at: string;
	updated_at: string;
}

function mapGpgKeyRow(row: GpgKeyMetaRow) {
	return {
		id: row.uuid,
		org_id: row.org_id,
		user_id: row.user_id,
		name: row.name,
		email: row.email,
		fingerprint: row.fingerprint,
		key_id: row.key_id,
		algorithm: row.algorithm,
		key_size: row.key_size,
		public_key: row.public_key,
		private_key_ref: row.private_key_ref,
		usage_flags: typeof row.usage_flags === "string" ? JSON.parse(row.usage_flags) : row.usage_flags,
		trust_level: row.trust_level,
		expires_at: row.expires_at ? new Date(row.expires_at) : null,
		revoked_at: row.revoked_at ? new Date(row.revoked_at) : null,
		revocation_reason: row.revocation_reason,
		is_default: row.is_default,
		created_at: new Date(row.created_at),
		updated_at: new Date(row.updated_at),
	};
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

		const algoConfig = algorithmToOpenPGP(algorithm, key_size);
		const { privateKey, publicKey } = await openpgp.generateKey({
			...algoConfig,
			userIDs: [{ name, email }],
			passphrase,
			format: "armored",
		} as openpgp.KeyOptions & { format: 'armored' });

		const parsedPublic = await openpgp.readKey({ armoredKey: publicKey });
		const fingerprint = parsedPublic.getFingerprint().toUpperCase();
		const keyId = fingerprint.slice(-16);

		const now = new Date();
		const expiresAt = expires_in_days
			? new Date(now.getTime() + expires_in_days * 24 * 60 * 60 * 1000)
			: null;

		const id = crypto.randomUUID();
		let gpgKeyRow: Record<string, unknown> | undefined;

		await runSaga("generateGpgKey", {}, [
			{
				name: "stdb-encrypt",
				execute: async () => {
					const stdb = STDBClient.getInstance();
					await stdb.callReducer("store_gpg_material", [
						org_id,
						fingerprint,
						privateKey,
						passphrase,
					]);
				},
			},
			{
				name: "stdb-insert-meta",
				execute: async () => {
					const stdb = STDBClient.getInstance();

					// If is_default, unset other defaults first
					if (is_default) {
						await stdb.callReducer("unset_default_gpg_keys", [org_id]);
					}

					await stdb.callReducer("create_gpg_key_meta", [
						id,
						org_id,
						user_id,
						name,
						email,
						fingerprint,
						keyId,
						algorithm,
						algorithm === "rsa" ? (key_size || 4096) : null,
						publicKey,
						`stdb:gpg:${org_id}:${fingerprint}`,
						JSON.stringify(usage_flags),
						"ultimate",
						expiresAt ? expiresAt.toISOString() : null,
						is_default || false,
					]);

					gpgKeyRow = {
						id,
						org_id,
						user_id,
						name,
						email,
						fingerprint,
						key_id: keyId,
						algorithm,
						key_size: algorithm === "rsa" ? (key_size || 4096) : null,
						public_key: publicKey,
						private_key_ref: `stdb:gpg:${org_id}:${fingerprint}`,
						usage_flags,
						trust_level: "ultimate",
						expires_at: expiresAt,
						revoked_at: null,
						revocation_reason: null,
						is_default: is_default || false,
						created_at: now,
						updated_at: now,
					};
				},
				compensate: async () => {
					const stdb = STDBClient.getInstance();
					await stdb.callReducer("delete_gpg_key_meta", [id]);
				},
			},
		]);

		await invalidateCache(CacheKeys.gpgKeysByOrg(org_id));

		return gpgKeyRow!;
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
			keySize = "bits" in algorithmInfo ? (algorithmInfo.bits as number) : null;
		} else {
			const curve = "curve" in algorithmInfo ? (algorithmInfo.curve as string) : "curve25519";
			algorithm = `ecc-${curve}`;
		}

		const privateKeyRef = armored_private_key ? `stdb:gpg:${org_id}:${fingerprint}` : "";
		const now = new Date();
		const id = crypto.randomUUID();
		let importedGpgKey: Record<string, unknown> | undefined;

		const sagaSteps: Parameters<typeof runSaga<Record<string, never>>>[2] = [];

		if (armored_private_key) {
			const newPassphrase = randomBytes(32).toString("hex");

			sagaSteps.push({
				name: "stdb-encrypt",
				execute: async () => {
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
					const reEncryptedArmor = reEncrypted.armor();

					// Store in SpaceTimeDB
					const stdb = STDBClient.getInstance();
					await stdb.callReducer("store_gpg_material", [
						org_id,
						fingerprint,
						reEncryptedArmor,
						newPassphrase,
					]);
				},
			});
		}

		sagaSteps.push({
			name: "stdb-insert-meta",
			execute: async () => {
				const stdb = STDBClient.getInstance();
				await stdb.callReducer("create_gpg_key_meta", [
					id,
					org_id,
					user_id,
					name,
					email,
					fingerprint,
					keyId,
					algorithm,
					keySize,
					armored_public_key,
					privateKeyRef,
					JSON.stringify(["sign", "encrypt"]),
					"unknown",
					null,
					false,
				]);

				importedGpgKey = {
					id,
					org_id,
					user_id,
					name,
					email,
					fingerprint,
					key_id: keyId,
					algorithm,
					key_size: keySize,
					public_key: armored_public_key,
					private_key_ref: privateKeyRef,
					usage_flags: ["sign", "encrypt"],
					trust_level: "unknown",
					expires_at: null,
					revoked_at: null,
					revocation_reason: null,
					is_default: false,
					created_at: now,
					updated_at: now,
				};
			},
			compensate: async () => {
				const stdb = STDBClient.getInstance();
				await stdb.callReducer("delete_gpg_key_meta", [id]);
			},
		});

		await runSaga("importGpgKey", {}, sagaSteps);

		await invalidateCache(CacheKeys.gpgKeysByOrg(org_id));

		return importedGpgKey!;
	};

	public static listKeys = async (org_id: string, page = 1, per_page = 50) => {
		const stdb = STDBClient.getInstance();
		const offset = (page - 1) * per_page;

		const rows = await stdb.query<GpgKeyMetaRow>(
			`SELECT * FROM gpg_key_meta WHERE org_id = '${org_id}' ORDER BY created_at DESC LIMIT ${per_page} OFFSET ${offset}`,
		);

		return rows.map((row) => ({
			id: row.uuid,
			org_id: row.org_id,
			user_id: row.user_id,
			name: row.name,
			email: row.email,
			fingerprint: row.fingerprint,
			key_id: row.key_id,
			algorithm: row.algorithm,
			key_size: row.key_size,
			usage_flags: typeof row.usage_flags === "string" ? JSON.parse(row.usage_flags) : row.usage_flags,
			trust_level: row.trust_level,
			expires_at: row.expires_at ? new Date(row.expires_at) : null,
			revoked_at: row.revoked_at ? new Date(row.revoked_at) : null,
			is_default: row.is_default,
			created_at: new Date(row.created_at),
			updated_at: new Date(row.updated_at),
		}));
	};

	public static getKey = async (id: string, org_id: string) => {
		return cacheAside(CacheKeys.gpgKey(id), CacheTTL.SHORT, async () => {
			const stdb = STDBClient.getInstance();
			const row = await stdb.queryOne<GpgKeyMetaRow>(
				`SELECT * FROM gpg_key_meta WHERE uuid = '${id}' AND org_id = '${org_id}'`,
			);

			if (!row) throw new NotFoundError("GPG Key", id);

			return mapGpgKeyRow(row);
		});
	};

	public static exportPublicKey = async (id: string, org_id: string) => {
		const key = await this.getKey(id, org_id);
		return {
			public_key: key.public_key,
			fingerprint: key.fingerprint,
		};
	};

	public static deleteKey = async (id: string, org_id: string) => {
		const key = await GpgKeyService.getKey(id, org_id);

		await runSaga("deleteGpgKey", {}, [
			{
				name: "stdb-delete-material",
				execute: async () => {
					if (key.private_key_ref && key.private_key_ref.startsWith("stdb:")) {
						const stdb = STDBClient.getInstance();
						await stdb.callReducer("delete_gpg_material", [org_id, key.fingerprint], { injectRootKey: false });
					}
				},
			},
			{
				name: "stdb-delete-meta",
				execute: async () => {
					const stdb = STDBClient.getInstance();
					await stdb.callReducer("delete_gpg_key_meta", [id]);
				},
			},
		]);

		await invalidateCache(CacheKeys.gpgKey(id));
	};

	public static revokeKey = async (id: string, org_id: string, reason?: string) => {
		const stdb = STDBClient.getInstance();

		await stdb.callReducer("revoke_gpg_key_meta", [
			id,
			org_id,
			reason || null,
		]);

		await invalidateCache(CacheKeys.gpgKey(id));

		return this.getKey(id, org_id);
	};

	public static updateTrustLevel = async (id: string, org_id: string, trust_level: string) => {
		const stdb = STDBClient.getInstance();

		await stdb.callReducer("update_gpg_key_trust", [
			id,
			org_id,
			trust_level,
		]);

		await invalidateCache(CacheKeys.gpgKey(id));

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
			throw new BusinessRuleError("Cannot sign with a revoked key");
		}
		if (!key.private_key_ref) {
			throw new BusinessRuleError("No private key available for signing");
		}

		// Retrieve private key and passphrase from SpaceTimeDB
		const stdb = STDBClient.getInstance();
		const armoredPrivateKey = await stdb.callReducer<string>("get_gpg_private_key", [org_id, key.fingerprint]);
		const passphrase = await stdb.callReducer<string>("get_gpg_passphrase", [org_id, key.fingerprint]);

		// Decrypt the private key
		const privateKey = await openpgp.decryptKey({
			privateKey: await openpgp.readPrivateKey({ armoredKey: armoredPrivateKey }),
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
		const stdb = STDBClient.getInstance();

		let publicKeys: openpgp.Key[];
		if (gpg_key_id) {
			const key = await this.getKey(gpg_key_id, org_id);
			publicKeys = [await openpgp.readKey({ armoredKey: key.public_key })];
		} else {
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

			let verification;
			try {
				const cleartextMessage = await openpgp.readCleartextMessage({ cleartextMessage: signatureArmored });
				verification = await openpgp.verify({
					message: cleartextMessage,
					verificationKeys: publicKeys,
				});
			} catch {
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

			let signerFingerprint: string | null = null;
			let signerDbKeyId: string | null = null;
			if (gpg_key_id) {
				const key = await this.getKey(gpg_key_id, org_id);
				signerFingerprint = key.fingerprint;
				signerDbKeyId = key.id;
			} else {
				const keys = await stdb.query<{
					uuid: string;
					fingerprint: string;
					key_id: string;
				}>(`SELECT uuid, fingerprint, key_id FROM gpg_key_meta WHERE org_id = '${org_id}'`);
				const match = keys.find((k) => k.key_id === signerKeyId || k.fingerprint.endsWith(signerKeyId));
				if (match) {
					signerFingerprint = match.fingerprint;
					signerDbKeyId = match.uuid;
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

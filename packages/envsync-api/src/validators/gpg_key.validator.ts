import z from "zod";
import "zod-openapi/extend";

export const gpgAlgorithmSchema = z.enum(["rsa", "ecc-curve25519", "ecc-p256", "ecc-p384"]);
export const gpgUsageFlagSchema = z.enum(["sign", "encrypt", "certify"]);
export const gpgTrustLevelSchema = z.enum(["unknown", "never", "marginal", "full", "ultimate"]);
export const gpgSignModeSchema = z.enum(["binary", "text", "clearsign"]);

// ─── Request schemas ────────────────────────────────────────────────

export const generateGpgKeyRequestSchema = z
	.object({
		name: z.string().min(1).openapi({ example: "My Signing Key" }),
		email: z.string().email().openapi({ example: "dev@example.com" }),
		algorithm: gpgAlgorithmSchema.openapi({ example: "ecc-curve25519" }),
		key_size: z.number().int().optional().openapi({ example: 4096 }),
		usage_flags: z.array(gpgUsageFlagSchema).min(1).openapi({ example: ["sign"] }),
		expires_in_days: z.number().int().positive().optional().openapi({ example: 365 }),
		is_default: z.boolean().optional().openapi({ example: false }),
	})
	.openapi({ ref: "GenerateGpgKeyRequest" });

export const importGpgKeyRequestSchema = z
	.object({
		name: z.string().min(1).openapi({ example: "Imported Key" }),
		armored_public_key: z.string().min(1).openapi({ example: "-----BEGIN PGP PUBLIC KEY BLOCK-----..." }),
		armored_private_key: z.string().optional().openapi({ example: "-----BEGIN PGP PRIVATE KEY BLOCK-----..." }),
		passphrase: z.string().optional().openapi({ example: "secret" }),
	})
	.openapi({ ref: "ImportGpgKeyRequest" });

export const signDataRequestSchema = z
	.object({
		gpg_key_id: z.string().min(1).openapi({ example: "key-uuid" }),
		data: z.string().min(1).openapi({ example: "base64-encoded-data" }),
		mode: gpgSignModeSchema.default("binary").openapi({ example: "binary" }),
		detached: z.boolean().default(true).openapi({ example: true }),
	})
	.openapi({ ref: "SignDataRequest" });

export const verifySignatureRequestSchema = z
	.object({
		data: z.string().min(1).openapi({ example: "base64-encoded-data" }),
		signature: z.string().min(1).openapi({ example: "-----BEGIN PGP SIGNATURE-----..." }),
		gpg_key_id: z.string().optional().openapi({ example: "key-uuid" }),
	})
	.openapi({ ref: "VerifySignatureRequest" });

export const revokeGpgKeyRequestSchema = z
	.object({
		reason: z.string().optional().openapi({ example: "Key compromised" }),
	})
	.openapi({ ref: "RevokeGpgKeyRequest" });

export const updateTrustLevelRequestSchema = z
	.object({
		trust_level: gpgTrustLevelSchema.openapi({ example: "full" }),
	})
	.openapi({ ref: "UpdateTrustLevelRequest" });

// ─── Response schemas ───────────────────────────────────────────────

export const gpgKeyResponseSchema = z
	.object({
		id: z.string().openapi({ example: "uuid" }),
		org_id: z.string().openapi({ example: "org_123" }),
		user_id: z.string().openapi({ example: "user_123" }),
		name: z.string().openapi({ example: "My Signing Key" }),
		email: z.string().openapi({ example: "dev@example.com" }),
		fingerprint: z.string().openapi({ example: "ABCDEF1234567890ABCDEF1234567890ABCDEF12" }),
		key_id: z.string().openapi({ example: "1234567890ABCDEF" }),
		algorithm: z.string().openapi({ example: "ecc-curve25519" }),
		key_size: z.number().nullable().openapi({ example: null }),
		usage_flags: z.array(z.string()).openapi({ example: ["sign"] }),
		trust_level: z.string().openapi({ example: "ultimate" }),
		expires_at: z.string().nullable().openapi({ example: null }),
		revoked_at: z.string().nullable().openapi({ example: null }),
		is_default: z.boolean().openapi({ example: false }),
		created_at: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "GpgKeyResponse" });

export const gpgKeyDetailResponseSchema = gpgKeyResponseSchema
	.extend({
		public_key: z.string().openapi({ example: "-----BEGIN PGP PUBLIC KEY BLOCK-----..." }),
		revocation_reason: z.string().nullable().openapi({ example: null }),
	})
	.openapi({ ref: "GpgKeyDetailResponse" });

export const gpgKeysResponseSchema = z
	.array(gpgKeyResponseSchema)
	.openapi({ ref: "GpgKeysResponse" });

export const signatureResponseSchema = z
	.object({
		signature: z.string().openapi({ example: "-----BEGIN PGP SIGNATURE-----..." }),
		key_id: z.string().openapi({ example: "key-uuid" }),
		fingerprint: z.string().openapi({ example: "ABCDEF1234567890" }),
	})
	.openapi({ ref: "SignatureResponse" });

export const verifyResponseSchema = z
	.object({
		valid: z.boolean().openapi({ example: true }),
		signer_fingerprint: z.string().nullable().openapi({ example: "ABCDEF1234567890" }),
		signer_key_id: z.string().nullable().openapi({ example: "key-uuid" }),
	})
	.openapi({ ref: "VerifyResponse" });

export const exportKeyResponseSchema = z
	.object({
		public_key: z.string().openapi({ example: "-----BEGIN PGP PUBLIC KEY BLOCK-----..." }),
		fingerprint: z.string().openapi({ example: "ABCDEF1234567890" }),
	})
	.openapi({ ref: "ExportKeyResponse" });

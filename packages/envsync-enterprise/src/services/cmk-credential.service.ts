import { v4 as uuidv4 } from "uuid";

import { DB } from "envsync-api/ports/db";
import { AppError, NotFoundError, ValidationError } from "envsync-api/ports/errors";
import { KMSClient, KMS_CONFIG_SCOPE_ID } from "envsync-api/ports/kms";

const PURPOSE = "kms";

type EncryptedSecretPayload = {
	v: 1;
	ciphertext: string;
	key_version_id: string;
};

export type CmkCredentialView = {
	id: string;
	org_id: string;
	key: string;
	description: string | null;
	configured: true;
	created_at: string;
	updated_at: string;
};

function toIso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function aadFor(orgId: string, secretId: string): string {
	return `org:${orgId}:kms-credential:${secretId}`;
}

function parseEncrypted(value: string): EncryptedSecretPayload {
	try {
		const parsed = JSON.parse(value) as EncryptedSecretPayload;
		if (parsed?.v !== 1 || !parsed.ciphertext || !parsed.key_version_id) {
			throw new Error("invalid");
		}
		return parsed;
	} catch {
		throw new AppError("Stored KMS credential is not in the encrypted envelope format.", 500, "CMK_CREDENTIAL_CORRUPT");
	}
}

function isKmsPurpose(metadata: unknown): boolean {
	if (!metadata || typeof metadata !== "object") {
		return false;
	}
	return (metadata as { purpose?: unknown }).purpose === PURPOSE;
}

export class CmkCredentialService {
	public static async create(input: {
		org_id: string;
		key: string;
		value: string;
		description?: string | null;
	}): Promise<CmkCredentialView> {
		const key = input.key.trim();
		if (!key) {
			throw new ValidationError("Credential key is required.");
		}
		if (!input.value) {
			throw new ValidationError("Credential value is required.");
		}

		const id = uuidv4();
		const kms = await KMSClient.getInstance();
		const encrypted = await kms.encrypt(input.org_id, KMS_CONFIG_SCOPE_ID, input.value, aadFor(input.org_id, id));
		const envelope: EncryptedSecretPayload = {
			v: 1,
			ciphertext: encrypted.ciphertext,
			key_version_id: encrypted.keyVersionId,
		};

		const now = new Date();
		const db = await DB.getInstance();
		await db
			.insertInto("org_secret")
			.values({
				id,
				org_id: input.org_id,
				key,
				value: JSON.stringify(envelope),
				description: input.description ?? null,
				metadata: { purpose: PURPOSE },
				created_at: now,
				updated_at: now,
			})
			.executeTakeFirstOrThrow();

		return {
			id,
			org_id: input.org_id,
			key,
			description: input.description ?? null,
			configured: true,
			created_at: toIso(now),
			updated_at: toIso(now),
		};
	}

	public static async list(orgId: string): Promise<CmkCredentialView[]> {
		const db = await DB.getInstance();
		const rows = await db
			.selectFrom("org_secret")
			.select(["id", "org_id", "key", "description", "metadata", "created_at", "updated_at"])
			.where("org_id", "=", orgId)
			.orderBy("created_at", "desc")
			.execute();

		return rows.filter(row => isKmsPurpose(row.metadata)).map(row => ({
			id: row.id,
			org_id: row.org_id,
			key: row.key,
			description: row.description ?? null,
			configured: true as const,
			created_at: toIso(row.created_at),
			updated_at: toIso(row.updated_at),
		}));
	}

	public static async getForOrg(orgId: string, secretId: string) {
		const db = await DB.getInstance();
		const row = await db
			.selectFrom("org_secret")
			.selectAll()
			.where("id", "=", secretId)
			.where("org_id", "=", orgId)
			.executeTakeFirst();
		if (!row || !isKmsPurpose(row.metadata)) {
			throw new NotFoundError("KmsCredential", secretId);
		}
		return row;
	}

	/**
	 * Decrypt a purpose=kms org_secret. Uses `__kms_config__` so the wrapping
	 * provider is never invoked (avoids wrapping CMK creds with the CMK).
	 */
	public static async decryptValue(orgId: string, secretId: string): Promise<string> {
		const row = await this.getForOrg(orgId, secretId);
		const envelope = parseEncrypted(row.value);
		const kms = await KMSClient.getInstance();
		const decrypted = await kms.decrypt(
			orgId,
			KMS_CONFIG_SCOPE_ID,
			envelope.ciphertext,
			aadFor(orgId, secretId),
			envelope.key_version_id,
		);
		return decrypted.plaintext;
	}
}

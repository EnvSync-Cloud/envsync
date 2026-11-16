import { AppError } from "envsync-api/ports/errors";
import { KMSClient, KMS_CONFIG_SCOPE_ID } from "envsync-api/ports/kms";

/**
 * Envelope written by CmkCredentialService. Same miniKMS scope (`__kms_config__`)
 * so server-side reads do not take a new key hierarchy or the tenant CMK.
 * Do not pass purpose=kms org secrets through this helper.
 */
export type CredentialEnvelope = {
	v: 1;
	ciphertext: string;
	key_version_id: string;
};

const ENVELOPE_KEYS = new Set(["v", "ciphertext", "key_version_id"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isCredentialEnvelope(value: unknown): value is CredentialEnvelope {
	if (!isRecord(value)) return false;
	const keys = Object.keys(value);
	if (keys.length !== 3 || !keys.every(key => ENVELOPE_KEYS.has(key))) return false;
	return value.v === 1
		&& typeof value.ciphertext === "string"
		&& value.ciphertext.length > 0
		&& typeof value.key_version_id === "string"
		&& value.key_version_id.length > 0;
}

export function isSealedString(value: string): boolean {
	try {
		return isCredentialEnvelope(JSON.parse(value));
	} catch {
		return false;
	}
}

export function asJsonRecord(value: unknown): Record<string, unknown> {
	if (typeof value === "string") {
		try {
			const parsed = JSON.parse(value) as unknown;
			if (isRecord(parsed)) return parsed;
		} catch {
			return {};
		}
	}
	return isRecord(value) ? value : {};
}

function headerIsSensitive(name: string): boolean {
	return /authorization|password|token|api[-_]?key|secret/i.test(name);
}

async function encryptPlaintext(orgId: string, aad: string, plaintext: string): Promise<CredentialEnvelope> {
	const kms = await KMSClient.getInstance();
	const encrypted = await kms.encrypt(orgId, KMS_CONFIG_SCOPE_ID, plaintext, aad);
	return {
		v: 1,
		ciphertext: encrypted.ciphertext,
		key_version_id: encrypted.keyVersionId,
	};
}

async function decryptEnvelope(orgId: string, aad: string, envelope: CredentialEnvelope): Promise<string> {
	const kms = await KMSClient.getInstance();
	try {
		const decrypted = await kms.decrypt(
			orgId,
			KMS_CONFIG_SCOPE_ID,
			envelope.ciphertext,
			aad,
			envelope.key_version_id,
		);
		return decrypted.plaintext;
	} catch {
		throw new AppError("Stored credential could not be decrypted.", 500, "CREDENTIAL_DECRYPT_FAILED");
	}
}

export async function sealStringCredential(orgId: string, aad: string, plaintext: string): Promise<string> {
	return JSON.stringify(await encryptPlaintext(orgId, aad, plaintext));
}

export async function openStringCredential(orgId: string, aad: string, stored: string): Promise<string> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(stored);
	} catch {
		throw new AppError("Stored credential is not in the encrypted envelope format.", 500, "CREDENTIAL_ENVELOPE_INVALID");
	}
	if (!isCredentialEnvelope(parsed)) {
		throw new AppError("Stored credential is not in the encrypted envelope format.", 500, "CREDENTIAL_ENVELOPE_INVALID");
	}
	return decryptEnvelope(orgId, aad, parsed);
}

export async function sealJsonCredential(orgId: string, aad: string, value: unknown): Promise<CredentialEnvelope> {
	return encryptPlaintext(orgId, aad, JSON.stringify(value));
}

export async function openJsonCredential(orgId: string, aad: string, stored: unknown): Promise<unknown> {
	if (!isCredentialEnvelope(stored)) {
		throw new AppError("Stored credential is not in the encrypted envelope format.", 500, "CREDENTIAL_ENVELOPE_INVALID");
	}
	const text = await decryptEnvelope(orgId, aad, stored);
	try {
		return JSON.parse(text);
	} catch {
		throw new AppError("Stored credential could not be decrypted.", 500, "CREDENTIAL_DECRYPT_FAILED");
	}
}

type SecretWalkMode = "seal" | "reveal";

async function mapSecretLeaf(
	orgId: string,
	aad: string,
	child: unknown,
	mode: SecretWalkMode,
): Promise<{ value: unknown; changed: boolean }> {
	if (mode === "seal") {
		if (typeof child === "string" && child.length > 0) {
			return { value: await encryptPlaintext(orgId, aad, child), changed: true };
		}
		return { value: child, changed: false };
	}
	if (isCredentialEnvelope(child)) {
		return { value: await decryptEnvelope(orgId, aad, child), changed: false };
	}
	if (typeof child === "string" && child.length > 0) {
		return { value: child, changed: true };
	}
	return { value: child, changed: false };
}

async function mapSecrets(
	orgId: string,
	aad: string,
	value: unknown,
	secretKeys: ReadonlySet<string>,
	mode: SecretWalkMode,
): Promise<{ value: unknown; changed: boolean }> {
	if (Array.isArray(value)) {
		let changed = false;
		const next: unknown[] = [];
		for (const item of value) {
			const mapped = await mapSecrets(orgId, aad, item, secretKeys, mode);
			changed = changed || mapped.changed;
			next.push(mapped.value);
		}
		return { value: next, changed };
	}
	if (!isRecord(value) || isCredentialEnvelope(value)) {
		return { value, changed: false };
	}

	let changed = false;
	const next: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value)) {
		if (key === "headers" && isRecord(child)) {
			const headers: Record<string, unknown> = {};
			for (const [header, headerValue] of Object.entries(child)) {
				if (!headerIsSensitive(header)) {
					headers[header] = headerValue;
					continue;
				}
				const mapped = await mapSecretLeaf(orgId, aad, headerValue, mode);
				changed = changed || mapped.changed;
				headers[header] = mapped.value;
			}
			next[key] = headers;
			continue;
		}
		if (secretKeys.has(key) && (typeof child === "string" || isCredentialEnvelope(child))) {
			const mapped = await mapSecretLeaf(orgId, aad, child, mode);
			changed = changed || mapped.changed;
			next[key] = mapped.value;
			continue;
		}
		const mapped = await mapSecrets(orgId, aad, child, secretKeys, mode);
		changed = changed || mapped.changed;
		next[key] = mapped.value;
	}
	return { value: next, changed };
}

export async function sealPlaintextSecrets(
	orgId: string,
	aad: string,
	value: Record<string, unknown>,
	secretKeys: ReadonlySet<string>,
): Promise<{ value: Record<string, unknown>; changed: boolean }> {
	const mapped = await mapSecrets(orgId, aad, value, secretKeys, "seal");
	return { value: mapped.value as Record<string, unknown>, changed: mapped.changed };
}

export async function revealSecrets(
	orgId: string,
	aad: string,
	value: Record<string, unknown>,
	secretKeys: ReadonlySet<string>,
): Promise<{ value: Record<string, unknown>; needsUpgrade: boolean }> {
	const mapped = await mapSecrets(orgId, aad, value, secretKeys, "reveal");
	return { value: mapped.value as Record<string, unknown>, needsUpgrade: mapped.changed };
}

/** Drop secret fields and envelopes. Does not decrypt. */
export function redactSecretFields(value: unknown, secretKeys: ReadonlySet<string>): unknown {
	if (Array.isArray(value)) {
		return value.map(item => redactSecretFields(item, secretKeys));
	}
	if (!isRecord(value) || isCredentialEnvelope(value)) {
		return isCredentialEnvelope(value) ? undefined : value;
	}
	const next: Record<string, unknown> = {};
	for (const [key, child] of Object.entries(value)) {
		if (key === "headers" && isRecord(child)) {
			const headers: Record<string, unknown> = {};
			for (const [header, headerValue] of Object.entries(child)) {
				if (headerIsSensitive(header) && (typeof headerValue === "string" || isCredentialEnvelope(headerValue))) {
					continue;
				}
				headers[header] = headerValue;
			}
			next[key] = headers;
			continue;
		}
		if (secretKeys.has(key) && (typeof child === "string" || isCredentialEnvelope(child))) {
			continue;
		}
		const redacted = redactSecretFields(child, secretKeys);
		if (redacted !== undefined) next[key] = redacted;
	}
	return next;
}

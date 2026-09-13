import { ValidationError } from "envsync-api/ports/errors";

type CloudKmsProviderSource = "aws-kms" | "gcp-kms" | "azure-kv";

export type CloudKmsWrapInput = {
	source: CloudKmsProviderSource;
	keyRef: string;
	region?: string | null;
	credentials: string;
	plaintext: Buffer;
};

export type CloudKmsUnwrapInput = {
	source: CloudKmsProviderSource;
	keyRef: string;
	region?: string | null;
	credentials: string;
	ciphertext: Buffer;
};

export type CloudKmsAdapter = {
	wrap(input: CloudKmsWrapInput): Promise<Buffer>;
	unwrap(input: CloudKmsUnwrapInput): Promise<Buffer>;
};

type JsonObject = Record<string, unknown>;

function parseJsonObject(raw: string, code: string): JsonObject {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("not object");
		}
		return parsed as JsonObject;
	} catch {
		throw new ValidationError("KMS credential value must be a JSON object.", code);
	}
}

function pickString(obj: JsonObject, ...keys: string[]): string | undefined {
	for (const key of keys) {
		const value = obj[key];
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim();
		}
	}
	return undefined;
}

function asBuffer(value: Uint8Array | Buffer | undefined, label: string): Buffer {
	if (!value || value.length === 0) {
		throw new ValidationError(`Cloud KMS returned an empty ${label}.`, "CMK_CLOUD_EMPTY_RESULT");
	}
	return Buffer.from(value);
}

function awsRegion(keyRef: string, region?: string | null): string {
	if (region && region.trim()) {
		return region.trim();
	}
	const match = /^arn:aws[-a-z]*:kms:([a-z0-9-]+):/.exec(keyRef);
	if (match?.[1]) {
		return match[1];
	}
	throw new ValidationError("AWS KMS region is required.", "CMK_REGION_REQUIRED");
}

function parseAwsCredentials(raw: string) {
	const obj = parseJsonObject(raw, "CMK_CREDENTIAL_INVALID");
	const accessKeyId = pickString(obj, "accessKeyId", "access_key_id");
	const secretAccessKey = pickString(obj, "secretAccessKey", "secret_access_key");
	if (!accessKeyId || !secretAccessKey) {
		throw new ValidationError(
			"AWS KMS credentials must include access_key_id and secret_access_key.",
			"CMK_CREDENTIAL_INVALID",
		);
	}
	return {
		accessKeyId,
		secretAccessKey,
		sessionToken: pickString(obj, "sessionToken", "session_token"),
	};
}

function parseAzureCredentials(raw: string) {
	const obj = parseJsonObject(raw, "CMK_CREDENTIAL_INVALID");
	const tenantId = pickString(obj, "tenantId", "tenant_id");
	const clientId = pickString(obj, "clientId", "client_id");
	const clientSecret = pickString(obj, "clientSecret", "client_secret");
	if (!tenantId || !clientId || !clientSecret) {
		throw new ValidationError(
			"Azure Key Vault credentials must include tenant_id, client_id, and client_secret.",
			"CMK_CREDENTIAL_INVALID",
		);
	}
	const algorithm = pickString(obj, "algorithm") ?? "RSA-OAEP-256";
	if (algorithm !== "RSA-OAEP-256") {
		throw new ValidationError("Azure wrap algorithm must be RSA-OAEP-256.", "CMK_CREDENTIAL_INVALID");
	}
	return {
		tenantId,
		clientId,
		clientSecret,
		algorithm,
	};
}

function parseGcpCredentials(raw: string): JsonObject {
	const obj = parseJsonObject(raw, "CMK_CREDENTIAL_INVALID");
	if (pickString(obj, "type") !== "service_account" || !pickString(obj, "client_email") || !pickString(obj, "private_key")) {
		throw new ValidationError(
			"GCP Cloud KMS credentials must be a service account JSON key.",
			"CMK_CREDENTIAL_INVALID",
		);
	}
	return obj;
}

/** Stable, non-secret label for last_error / logs. Never include key material. */
export function sanitizeCloudError(error: unknown): string {
	if (error instanceof ValidationError || (error && typeof error === "object" && "code" in error)) {
		const code = (error as { code?: unknown }).code;
		if (typeof code === "string" && code.length > 0 && code.length < 80 && /^[A-Z0-9_]+$/.test(code)) {
			return code;
		}
	}
	const err = error as { name?: string; Code?: string; code?: string };
	const candidate = err.Code ?? (typeof err.code === "string" ? err.code : undefined) ?? err.name;
	if (typeof candidate === "string" && candidate.length > 0 && candidate.length < 80) {
		return candidate.replace(/\s+/g, "_").slice(0, 80);
	}
	return "cloud_kms_error";
}

async function liveAwsWrap(input: CloudKmsWrapInput): Promise<Buffer> {
	const credentials = parseAwsCredentials(input.credentials);
	const region = awsRegion(input.keyRef, input.region);
	const { KMSClient, EncryptCommand } = await import("@aws-sdk/client-kms");
	const client = new KMSClient({
		region,
		credentials,
	});
	try {
		const result = await client.send(
			new EncryptCommand({
				KeyId: input.keyRef,
				Plaintext: input.plaintext,
			}),
		);
		return asBuffer(result.CiphertextBlob, "ciphertext");
	} finally {
		client.destroy();
	}
}

async function liveAwsUnwrap(input: CloudKmsUnwrapInput): Promise<Buffer> {
	const credentials = parseAwsCredentials(input.credentials);
	const region = awsRegion(input.keyRef, input.region);
	const { KMSClient, DecryptCommand } = await import("@aws-sdk/client-kms");
	const client = new KMSClient({
		region,
		credentials,
	});
	try {
		const result = await client.send(
			new DecryptCommand({
				KeyId: input.keyRef,
				CiphertextBlob: input.ciphertext,
			}),
		);
		return asBuffer(result.Plaintext, "plaintext");
	} finally {
		client.destroy();
	}
}

async function liveGcpWrap(input: CloudKmsWrapInput): Promise<Buffer> {
	const credentials = parseGcpCredentials(input.credentials);
	const { KeyManagementServiceClient } = await import("@google-cloud/kms");
	const client = new KeyManagementServiceClient({
		credentials,
		projectId: pickString(credentials, "project_id"),
	});
	try {
		const [result] = await client.encrypt({
			name: input.keyRef,
			plaintext: input.plaintext,
		});
		return asBuffer(result.ciphertext, "ciphertext");
	} finally {
		await client.close();
	}
}

async function liveGcpUnwrap(input: CloudKmsUnwrapInput): Promise<Buffer> {
	const credentials = parseGcpCredentials(input.credentials);
	const { KeyManagementServiceClient } = await import("@google-cloud/kms");
	const client = new KeyManagementServiceClient({
		credentials,
		projectId: pickString(credentials, "project_id"),
	});
	try {
		const [result] = await client.decrypt({
			name: input.keyRef,
			ciphertext: input.ciphertext,
		});
		return asBuffer(result.plaintext, "plaintext");
	} finally {
		await client.close();
	}
}

async function liveAzureWrap(input: CloudKmsWrapInput): Promise<Buffer> {
	const creds = parseAzureCredentials(input.credentials);
	const { ClientSecretCredential } = await import("@azure/identity");
	const { CryptographyClient } = await import("@azure/keyvault-keys");
	const credential = new ClientSecretCredential(creds.tenantId, creds.clientId, creds.clientSecret);
	const client = new CryptographyClient(input.keyRef, credential);
	const result = await client.wrapKey(creds.algorithm as "RSA-OAEP-256", input.plaintext);
	return asBuffer(result.result, "ciphertext");
}

async function liveAzureUnwrap(input: CloudKmsUnwrapInput): Promise<Buffer> {
	const creds = parseAzureCredentials(input.credentials);
	const { ClientSecretCredential } = await import("@azure/identity");
	const { CryptographyClient } = await import("@azure/keyvault-keys");
	const credential = new ClientSecretCredential(creds.tenantId, creds.clientId, creds.clientSecret);
	const client = new CryptographyClient(input.keyRef, credential);
	const result = await client.unwrapKey(creds.algorithm as "RSA-OAEP-256", input.ciphertext);
	return asBuffer(result.result, "plaintext");
}

export class CmkCloudProvider {
	static #testAdapter: CloudKmsAdapter | null = null;

	public static setTestAdapter(adapter: CloudKmsAdapter | null) {
		this.#testAdapter = adapter;
	}

	public static async wrap(input: CloudKmsWrapInput): Promise<Buffer> {
		if (this.#testAdapter) {
			return this.#testAdapter.wrap(input);
		}
		switch (input.source) {
			case "aws-kms":
				return liveAwsWrap(input);
			case "gcp-kms":
				return liveGcpWrap(input);
			case "azure-kv":
				return liveAzureWrap(input);
		}
	}

	public static async unwrap(input: CloudKmsUnwrapInput): Promise<Buffer> {
		if (this.#testAdapter) {
			return this.#testAdapter.unwrap(input);
		}
		switch (input.source) {
			case "aws-kms":
				return liveAwsUnwrap(input);
			case "gcp-kms":
				return liveGcpUnwrap(input);
			case "azure-kv":
				return liveAzureUnwrap(input);
		}
	}
}

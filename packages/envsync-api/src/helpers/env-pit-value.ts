import { KMSClient } from "@/libs/kms/client";

/** Sealed env history values. Legacy rows do not use this prefix and are not rewritten. */
export const ENV_PIT_SEALED_PREFIX = "envpit:v1:";

/** Live vault read failed. Do not substitute the stored history cell. */
export const REDACTED_ENV_PIT_VALUE = "[REDACTED]";

type PitValueRow = {
	key: string;
	value: string;
};

function envPitValueAad(orgId: string, appId: string, envTypeId: string, key: string) {
	return `env-pit:${orgId}:${appId}:${envTypeId}:${key}`;
}

function packSealedValue(keyVersionId: string, ciphertext: string) {
	return `${ENV_PIT_SEALED_PREFIX}${keyVersionId}:${ciphertext}`;
}

function unpackSealedValue(value: string): { keyVersionId: string; ciphertext: string } | null {
	if (!value.startsWith(ENV_PIT_SEALED_PREFIX)) return null;
	const rest = value.slice(ENV_PIT_SEALED_PREFIX.length);
	const splitAt = rest.indexOf(":");
	if (splitAt <= 0 || splitAt >= rest.length - 1) return null;
	return {
		keyVersionId: rest.slice(0, splitAt),
		ciphertext: rest.slice(splitAt + 1),
	};
}

export async function sealEnvPitValues<T extends PitValueRow>(
	orgId: string,
	appId: string,
	envTypeId: string,
	rows: T[],
): Promise<T[]> {
	if (rows.length === 0) return rows;

	const kms = await KMSClient.getInstance();
	const sealed = await kms.batchEncrypt(
		orgId,
		appId,
		rows.map(row => ({
			plaintext: row.value ?? "",
			aad: envPitValueAad(orgId, appId, envTypeId, row.key),
		})),
	);
	if (sealed.length !== rows.length) {
		throw new Error("KMS batch encrypt returned an unexpected number of env history values");
	}

	return rows.map((row, index) => ({
		...row,
		value: packSealedValue(sealed[index].keyVersionId, sealed[index].ciphertext),
	}));
}

/**
 * Reopen sealed history values for authorized readers.
 * Rows without the seal prefix are historical plaintext and are returned unchanged.
 */
export async function openEnvPitValues<T extends PitValueRow>(
	orgId: string,
	appId: string,
	envTypeId: string,
	rows: T[],
): Promise<T[]> {
	const normalized = rows.map(row => ({ ...row, value: row.value ?? "" }));
	const sealedIndexes: number[] = [];
	const items: { ciphertext: string; aad: string; keyVersionId: string }[] = [];

	for (let index = 0; index < normalized.length; index++) {
		const value = normalized[index].value;
		if (!value.startsWith(ENV_PIT_SEALED_PREFIX)) continue;
		const packed = unpackSealedValue(value);
		if (!packed) {
			throw new Error("Invalid sealed env history value");
		}
		sealedIndexes.push(index);
		items.push({
			ciphertext: packed.ciphertext,
			keyVersionId: packed.keyVersionId,
			aad: envPitValueAad(orgId, appId, envTypeId, normalized[index].key),
		});
	}

	if (items.length === 0) return normalized;

	const kms = await KMSClient.getInstance();
	const opened = await kms.batchDecrypt(orgId, appId, items);
	if (opened.length !== items.length) {
		throw new Error("KMS batch decrypt returned an unexpected number of env history values");
	}

	for (let itemIndex = 0; itemIndex < sealedIndexes.length; itemIndex++) {
		const rowIndex = sealedIndexes[itemIndex];
		normalized[rowIndex] = {
			...normalized[rowIndex],
			value: opened[itemIndex].plaintext,
		};
	}

	return normalized;
}

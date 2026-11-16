import { kmsDecrypt } from "@/helpers/key-store";
import { BusinessRuleError } from "@/libs/errors";
import { KMSClient } from "@/libs/kms/client";

const SEALED_PREFIX = "KMS:v1:";

type ChangeRequestValueField = "previous" | "proposed";

type ChangeRequestValueRef = {
	orgId: string;
	appId: string;
	changeRequestId: string;
	itemId: string;
};

function valueAad(ref: ChangeRequestValueRef, field: ChangeRequestValueField) {
	return `change-request:${ref.orgId}:${ref.appId}:${ref.changeRequestId}:${ref.itemId}:${field}`;
}

export function isSealedChangeRequestValue(value: string | null | undefined) {
	return typeof value === "string" && value.startsWith(SEALED_PREFIX);
}

function unreadableValue() {
	return new BusinessRuleError(
		"Change request value could not be decrypted.",
		500,
		"CHANGE_REQUEST_VALUE_UNREADABLE",
	);
}

/** Persist a change-request value as miniKMS ciphertext. Null means the column is omitted. */
export async function sealChangeRequestValue(
	ref: ChangeRequestValueRef,
	field: ChangeRequestValueField,
	value: string | null | undefined,
): Promise<string | null> {
	if (value == null) return null;
	const kms = await KMSClient.getInstance();
	const result = await kms.encrypt(ref.orgId, ref.appId, value, valueAad(ref, field));
	return `${SEALED_PREFIX}${result.keyVersionId}:${result.ciphertext}`;
}

/**
 * Decrypt a sealed change-request value.
 * Rows written before sealing are returned unchanged and are not rewritten.
 * A sealed value that cannot be decrypted fails closed.
 */
export async function openChangeRequestValue(
	ref: ChangeRequestValueRef,
	field: ChangeRequestValueField,
	stored: string | null | undefined,
): Promise<string | null> {
	if (stored == null) return null;
	if (!isSealedChangeRequestValue(stored)) return stored;
	try {
		return await kmsDecrypt(ref.orgId, ref.appId, stored, valueAad(ref, field));
	} catch {
		throw unreadableValue();
	}
}

export async function sealChangeRequestValues(
	ref: ChangeRequestValueRef,
	values: { previous: string | null; proposed: string | null },
) {
	const [previous_value, proposed_value] = await Promise.all([
		sealChangeRequestValue(ref, "previous", values.previous),
		sealChangeRequestValue(ref, "proposed", values.proposed),
	]);
	return { previous_value, proposed_value };
}

export async function openChangeRequestValues(
	ref: ChangeRequestValueRef,
	values: { previous: string | null | undefined; proposed: string | null | undefined },
) {
	const [previous_value, proposed_value] = await Promise.all([
		openChangeRequestValue(ref, "previous", values.previous),
		openChangeRequestValue(ref, "proposed", values.proposed),
	]);
	return { previous_value, proposed_value };
}

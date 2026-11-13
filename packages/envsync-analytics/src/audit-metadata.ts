/**
 * Field names that carry a variable value, or text that embeds old and new values.
 * Audit rows, webhook bodies, and forwarded log lines keep the surrounding metadata.
 */
export const AUDIT_VALUE_FIELD_NAMES = [
	"access_token",
	"armored_private_key",
	"cert_pem",
	"changes",
	"ciphertext",
	"current_value",
	"deleted_value",
	"deleted_values",
	"key_pem",
	"metadata_xml",
	"new_value",
	"old_value",
	"passphrase",
	"password",
	"plaintext",
	"previous_value",
	"private_key",
	"proposed_value",
	"refresh_token",
	"saml_response",
	"secret",
	"target_value",
	"token",
	"value",
	"wrapped_kek",
] as const;

const VALUE_FIELDS = new Set<string>(AUDIT_VALUE_FIELD_NAMES);

export function toMetadataOnlyAuditDetails(input: unknown): unknown {
	if (Array.isArray(input)) {
		return input.map((item) => toMetadataOnlyAuditDetails(item));
	}
	if (input && typeof input === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
			if (VALUE_FIELDS.has(key.toLowerCase())) continue;
			out[key] = toMetadataOnlyAuditDetails(value);
		}
		return out;
	}
	return input;
}

/** JSON messages are metadata-only. Plain sentences are left as written. */
export function metadataOnlyAuditMessage(message: string): string {
	const trimmed = message.trim();
	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return message;
	try {
		return JSON.stringify(toMetadataOnlyAuditDetails(JSON.parse(message)));
	} catch {
		return message;
	}
}

export type AuditForwardPayload = {
	action: string;
	org_id: string;
	user_id: string;
	message: string;
	details: Record<string, unknown>;
};

export function forwardedAuditRecord<T extends AuditForwardPayload>(payload: T): T {
	return {
		...payload,
		message: metadataOnlyAuditMessage(payload.message),
		details: toMetadataOnlyAuditDetails(payload.details) as Record<string, unknown>,
	};
}

export function forwardedAuditLine(payload: AuditForwardPayload): string {
	return JSON.stringify(forwardedAuditRecord(payload));
}

export function prepareAuditEmission(input: {
	action: string;
	org_id: string;
	user_id: string;
	message: string;
	details?: Record<string, unknown>;
}) {
	const details = toMetadataOnlyAuditDetails(input.details ?? {}) as Record<string, unknown>;
	const detailsJson = JSON.stringify(details);
	return {
		details,
		detailsJson,
		message: metadataOnlyAuditMessage(input.message),
		webhookMessage: metadataOnlyAuditMessage(detailsJson),
		forwarded: forwardedAuditRecord({
			action: input.action,
			org_id: input.org_id,
			user_id: input.user_id,
			message: input.message,
			details: input.details ?? {},
		}),
		forwardedLine: forwardedAuditLine({
			action: input.action,
			org_id: input.org_id,
			user_id: input.user_id,
			message: input.message,
			details: input.details ?? {},
		}),
	};
}

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

const REDACTED = "<redacted>";

/** Verbs whose positional arguments are values, except the first name on set-style verbs. */
const SET_STYLE = new Set(["set", "put", "write", "upsert"]);
const IMPORT_STYLE = new Set(["import", "load", "apply"]);

/** Flag names whose following token is an identifier, not a variable value. */
const NAME_FLAGS = new Set(["key", "k", "name", "n"]);

function flagBase(token: string): string {
	return token.replace(/^-+/, "").split("=", 1)[0]?.toLowerCase() ?? "";
}

function assignment(token: string): { name: string; value: string } | null {
	const eq = token.indexOf("=");
	if (eq <= 0) return null;
	return { name: token.slice(0, eq), value: token.slice(eq + 1) };
}

/** Split a command line on whitespace, keeping quoted segments together. */
export function tokenizeCliCommand(input: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: '"' | "'" | null = null;
	for (let i = 0; i < input.length; i++) {
		const ch = input[i];
		if (quote) {
			if (ch === quote) {
				quote = null;
				continue;
			}
			if (ch === "\\" && quote === '"' && i + 1 < input.length) {
				current += input[i + 1];
				i++;
				continue;
			}
			current += ch;
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
			continue;
		}
		if (ch === "\\" && i + 1 < input.length) {
			current += input[i + 1];
			i++;
			continue;
		}
		if (/\s/.test(ch)) {
			if (current) tokens.push(current);
			current = "";
			continue;
		}
		current += ch;
	}
	if (current) tokens.push(current);
	return tokens;
}

/**
 * Keep the command name and flag or argument names.
 * Values after `=` are replaced, and positional values on set or import-style commands are replaced.
 */
export function redactCliCommand(input: string): string {
	const tokens = tokenizeCliCommand(input);
	let verb: string | null = null;
	let keptSetName = false;
	const out: string[] = [];

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		const pair = assignment(token);
		if (pair) {
			const base = flagBase(pair.name);
			const keepValue = token.startsWith("-") && NAME_FLAGS.has(base);
			out.push(keepValue ? token : `${pair.name}=${REDACTED}`);
			if (verb && SET_STYLE.has(verb)) keptSetName = true;
			continue;
		}

		if (token.startsWith("-") && token.length > 1) {
			out.push(token);
			const next = tokens[i + 1];
			if (next && !next.startsWith("-")) {
				if (NAME_FLAGS.has(flagBase(token))) {
					out.push(next);
					if (verb && SET_STYLE.has(verb)) keptSetName = true;
				} else {
					out.push(REDACTED);
				}
				i++;
			}
			continue;
		}

		const bare = token.toLowerCase();
		if (SET_STYLE.has(bare) || IMPORT_STYLE.has(bare)) {
			verb = bare;
			keptSetName = false;
			out.push(token);
			continue;
		}

		if (verb && SET_STYLE.has(verb)) {
			if (!keptSetName) {
				out.push(token);
				keptSetName = true;
				continue;
			}
			out.push(REDACTED);
			continue;
		}

		if (verb && IMPORT_STYLE.has(verb)) {
			out.push(REDACTED);
			continue;
		}

		out.push(token);
	}

	return out.join(" ");
}

function redactCommandField(value: string): string {
	return redactCliCommand(value);
}

function redactCommandInMessage(message: string, details: Record<string, unknown> | undefined): string {
	const raw = details && typeof details.command === "string" ? details.command : "";
	if (!raw) return message;
	const redacted = redactCliCommand(raw);
	if (!redacted || redacted === raw) return message;
	return message.split(raw).join(redacted);
}

export function toMetadataOnlyAuditDetails(input: unknown): unknown {
	if (Array.isArray(input)) {
		return input.map((item) => toMetadataOnlyAuditDetails(item));
	}
	if (input && typeof input === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
			if (VALUE_FIELDS.has(key.toLowerCase())) continue;
			if (key.toLowerCase() === "command" && typeof value === "string") {
				out[key] = redactCommandField(value);
				continue;
			}
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
		message: metadataOnlyAuditMessage(redactCommandInMessage(payload.message, payload.details)),
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
	const rawDetails = input.details ?? {};
	const details = toMetadataOnlyAuditDetails(rawDetails) as Record<string, unknown>;
	const detailsJson = JSON.stringify(details);
	const message = metadataOnlyAuditMessage(redactCommandInMessage(input.message, rawDetails));
	return {
		details,
		detailsJson,
		message,
		webhookMessage: metadataOnlyAuditMessage(detailsJson),
		forwarded: forwardedAuditRecord({
			action: input.action,
			org_id: input.org_id,
			user_id: input.user_id,
			message,
			details: rawDetails,
		}),
		forwardedLine: forwardedAuditLine({
			action: input.action,
			org_id: input.org_id,
			user_id: input.user_id,
			message,
			details: rawDetails,
		}),
	};
}

import { AUDIT_VALUE_FIELD_NAMES } from "envsync-analytics";

/** Marker written instead of an env value. The field name stays. */
export const LOG_REDACTED = "[REDACTED]";

const MAX_DEPTH = 32;

/** Keys already redacted before the audit value-field list existed. */
const EXTRA_SENSITIVE_KEYS = [
	"apiKey",
	"api_key",
	"apikey",
	"passwd",
	"pwd",
	"secretKey",
	"secret_key",
	"accessToken",
	"refreshToken",
	"sessionToken",
	"session_token",
	"authorization",
	"privateKey",
	"superuser",
] as const;

const SENSITIVE_KEYS = new Set<string>(
	[...EXTRA_SENSITIVE_KEYS, ...AUDIT_VALUE_FIELD_NAMES].map(key => key.toLowerCase()),
);

const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
	// API key secrets. Display hints are shorter than this and are left intact.
	{ pattern: /\beVs_[A-Za-z0-9_-]{12,}\b/g, replacement: "eVs_[REDACTED]" },
	// Connection strings: postgres://user:pass@host
	{ pattern: /(\w+:\/\/[^:]+:)[^@]+(@)/g, replacement: "$1[REDACTED]$2" },
	// Key=value pairs: apiKey=xxx, password=xxx, api_key=xxx
	{
		pattern: /(api[_-]?key|password|secret|token|authorization)\s*[=:]\s*\S+/gi,
		replacement: "$1=[REDACTED]",
	},
	// Bearer tokens
	{ pattern: /Bearer\s+\S+/gi, replacement: "Bearer [REDACTED]" },
];

const ASSIGNMENT_SOURCE = [...SENSITIVE_KEYS]
	.sort((left, right) => right.length - left.length)
	.map(key => key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
	.join("|");

const ASSIGNMENT_PATTERN = new RegExp(`\\b(?:${ASSIGNMENT_SOURCE})\\b\\s*[=:]\\s*`, "i");

function isSensitiveKey(key: string): boolean {
	return SENSITIVE_KEYS.has(key.toLowerCase());
}

function sameJson(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

function redactPatterns(input: string): string {
	let result = input;
	for (const { pattern, replacement } of SENSITIVE_PATTERNS) {
		pattern.lastIndex = 0;
		result = result.replace(pattern, replacement);
		pattern.lastIndex = 0;
	}
	return result;
}

function extractBalanced(input: string, start: number): string | null {
	const open = input[start];
	if (open !== "{" && open !== "[") return null;
	const close = open === "{" ? "}" : "]";
	let depth = 0;
	let inString = false;
	let escape = false;
	for (let i = start; i < input.length; i++) {
		const ch = input[i];
		if (inString) {
			if (escape) {
				escape = false;
				continue;
			}
			if (ch === "\\") {
				escape = true;
				continue;
			}
			if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === open) depth++;
		else if (ch === close) {
			depth--;
			if (depth === 0) return input.slice(start, i + 1);
		}
	}
	return null;
}

function consumeQuoted(input: string, start: number): number {
	const quote = input[start];
	let escape = false;
	for (let i = start + 1; i < input.length; i++) {
		const ch = input[i];
		if (escape) {
			escape = false;
			continue;
		}
		if (ch === "\\") {
			escape = true;
			continue;
		}
		if (ch === quote) return i - start + 1;
	}
	return input.length - start;
}

function consumeAssignedValue(input: string, start: number): number {
	if (start >= input.length) return 0;
	const ch = input[start];
	if (ch === '"' || ch === "'") return consumeQuoted(input, start);
	if (ch === "{" || ch === "[") {
		const balanced = extractBalanced(input, start);
		if (balanced) {
			try {
				const parsed = JSON.parse(balanced);
				if (parsed && typeof parsed === "object") return balanced.length;
			} catch {
				// Not JSON. Treat the value as a single token below.
			}
		}
	}
	const token = /^\S+/.exec(input.slice(start));
	return token ? token[0].length : 0;
}

function findNextAssignment(
	input: string,
	from: number,
): { keyStart: number; name: string; valueEnd: number } | null {
	const match = ASSIGNMENT_PATTERN.exec(input.slice(from));
	if (!match || match.index === undefined) return null;
	const name = /[A-Za-z0-9_]+/.exec(match[0])?.[0] ?? "value";
	const valueStart = from + match.index + match[0].length;
	return {
		keyStart: from + match.index,
		name,
		valueEnd: valueStart + consumeAssignedValue(input, valueStart),
	};
}

function findNextBrace(input: string, from: number): number | null {
	const curly = input.indexOf("{", from);
	const square = input.indexOf("[", from);
	if (curly === -1 && square === -1) return null;
	if (curly === -1) return square;
	if (square === -1) return curly;
	return Math.min(curly, square);
}

function takeJsonContainer(
	input: string,
	start: number,
	depth: number,
	seen: WeakSet<object>,
): { length: number; text: string } | null {
	const slice = extractBalanced(input, start);
	if (!slice) return null;
	try {
		const parsed = JSON.parse(slice);
		if (!parsed || typeof parsed !== "object") return null;
		const redacted = redactValue(parsed, depth + 1, seen);
		const text = sameJson(parsed, redacted) ? slice : JSON.stringify(redacted);
		return { length: slice.length, text };
	} catch {
		return null;
	}
}

function redactMixed(input: string, depth: number, seen: WeakSet<object>): string {
	let out = "";
	let index = 0;
	while (index < input.length) {
		const assignment = findNextAssignment(input, index);
		const brace = findNextBrace(input, index);
		const assignmentAt = assignment?.keyStart ?? -1;
		let next = -1;
		if (assignmentAt === -1) next = brace ?? -1;
		else if (brace == null) next = assignmentAt;
		else next = Math.min(assignmentAt, brace);

		if (next === -1) {
			out += redactPatterns(input.slice(index));
			break;
		}
		if (next > index) out += redactPatterns(input.slice(index, next));

		if (assignment && assignment.keyStart === next) {
			out += `${assignment.name}=${LOG_REDACTED}`;
			const advanced = assignment.valueEnd > next ? assignment.valueEnd : next + 1;
			index = advanced;
			continue;
		}

		const container = takeJsonContainer(input, next, depth, seen);
		if (container) {
			out += container.text;
			index = next + container.length;
			continue;
		}
		out += input[next] ?? "";
		index = next + 1;
	}
	return out;
}

function redactLogString(input: string, depth: number, seen: WeakSet<object>): string {
	if (depth > MAX_DEPTH) return LOG_REDACTED;
	return redactMixed(input, depth, seen);
}

function redactError(error: Error, depth: number, seen: WeakSet<object>): Error {
	if (seen.has(error)) return new Error("[Circular]");
	seen.add(error);
	try {
		const copy = new Error(redactLogString(error.message, depth + 1, seen));
		copy.name = error.name;
		if (typeof error.stack === "string") {
			copy.stack = redactLogString(error.stack, depth + 1, seen);
		}
		const extras = error as Error & Record<string, unknown>;
		for (const key of Object.keys(extras)) {
			(copy as Error & Record<string, unknown>)[key] = isSensitiveKey(key)
				? LOG_REDACTED
				: redactValue(extras[key], depth + 1, seen);
		}
		return copy;
	} finally {
		seen.delete(error);
	}
}

function redactValue(input: unknown, depth: number, seen: WeakSet<object>): unknown {
	if (input == null) return input;
	if (typeof input === "string") return redactLogString(input, depth, seen);
	if (typeof input !== "object") return input;
	if (depth > MAX_DEPTH) return LOG_REDACTED;
	if (seen.has(input)) return "[Circular]";
	if (input instanceof Date) return input;
	if (typeof Buffer !== "undefined" && Buffer.isBuffer(input)) return input;
	if (ArrayBuffer.isView(input)) return input;
	if (input instanceof Error) return redactError(input, depth, seen);

	seen.add(input);
	try {
		if (Array.isArray(input)) {
			return input.map(item => redactValue(item, depth + 1, seen));
		}
		const redacted: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(input)) {
			redacted[key] = isSensitiveKey(key) ? LOG_REDACTED : redactValue(value, depth + 1, seen);
		}
		return redacted;
	} finally {
		seen.delete(input);
	}
}

/**
 * Replace env value fields in a log message or structured payload.
 * Nested objects and JSON strings (request bodies) are covered.
 * Returns a new value; the caller's object is not mutated.
 */
export function redactLogPayload(input: unknown): unknown {
	try {
		return redactValue(input, 0, new WeakSet());
	} catch {
		return LOG_REDACTED;
	}
}

/** Redact one pino NDJSON record. The trailing newline is preserved. */
export function redactWrittenLog(line: string): string {
	const newline = line.endsWith("\n");
	const body = newline ? line.slice(0, -1) : line;
	let next = body;
	try {
		if (body.startsWith("{") || body.startsWith("[")) {
			const parsed = JSON.parse(body) as unknown;
			if (parsed && typeof parsed === "object") {
				const redacted = redactValue(parsed, 0, new WeakSet());
				next = sameJson(parsed, redacted) ? body : JSON.stringify(redacted);
			} else {
				next = redactLogString(body, 0, new WeakSet());
			}
		} else {
			next = redactLogString(body, 0, new WeakSet());
		}
	} catch {
		next = JSON.stringify({ msg: LOG_REDACTED });
	}
	return newline ? `${next}\n` : next;
}

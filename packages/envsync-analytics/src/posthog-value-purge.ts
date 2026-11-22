import { AUDIT_VALUE_FIELD_NAMES } from "./audit-metadata";

/**
 * Property names historical PostHog events may still carry.
 * Same set new writes drop. Queries test key presence and never select values.
 * JSONHas is required: JSONExtractString is '' when a key is missing, so
 * `IS NOT NULL` would match every event.
 *
 * `$set` is checked anyway. PostHog usually drops it after updating the person,
 * and those live person properties are unset separately. Event rows are not
 * deleted only because a person-property snapshot still has one of these names.
 */
export const POSTHOG_PURGE_PROPERTY_NAMES: readonly string[] = AUDIT_VALUE_FIELD_NAMES;

const VALUE_FIELDS = new Set<string>(POSTHOG_PURGE_PROPERTY_NAMES);
const PERSON_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DELETION_STATUSES = new Set(["draft", "pending", "approved", "in_progress", "queued", "completed", "failed"]);

const APP_ORIGINS: Record<string, string> = {
	"eu.i.posthog.com": "https://eu.posthog.com",
	"eu.posthog.com": "https://eu.posthog.com",
	"us.i.posthog.com": "https://us.posthog.com",
	"us.posthog.com": "https://us.posthog.com",
	"app.posthog.com": "https://us.posthog.com",
};

export type PosthogPurgePlan =
	| { run: false; message: string; exitCode: number }
	| { run: true; appOrigin: string; apply: boolean };

export function isValueBearingPropertyName(name: string): boolean {
	return VALUE_FIELDS.has(name.toLowerCase());
}

/** Names only. Nested objects and arrays are walked. Values are not returned. */
export function valueBearingPropertyNames(input: unknown): string[] {
	const found = new Set<string>();
	walk(input, found);
	return [...found].sort();
}

function walk(input: unknown, found: Set<string>): void {
	if (Array.isArray(input)) {
		for (const item of input) walk(item, found);
		return;
	}
	if (!input || typeof input !== "object") return;
	for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
		if (isValueBearingPropertyName(key)) found.add(key.toLowerCase());
		walk(value, found);
	}
}

export function planPosthogPurge(
	env: { POSTHOG_HOST?: string; POSTHOG_KEY?: string },
	options: { apply: boolean },
): PosthogPurgePlan {
	const host = env.POSTHOG_HOST?.trim() ?? "";
	const key = env.POSTHOG_KEY?.trim() ?? "";
	if (!host || !key) {
		return {
			run: false,
			message: "PostHog purge was not run (POSTHOG_HOST or POSTHOG_KEY unset).",
			exitCode: options.apply ? 1 : 0,
		};
	}
	if (!isPersonalApiKey(key)) {
		return {
			run: false,
			message: "PostHog purge was not run (personal API key is not set).",
			exitCode: options.apply ? 1 : 0,
		};
	}
	const appOrigin = posthogAppOrigin(host);
	if (!appOrigin) {
		return {
			run: false,
			message: "PostHog purge was not run (POSTHOG_HOST is not a PostHog app host).",
			exitCode: options.apply ? 1 : 0,
		};
	}
	return { run: true, appOrigin, apply: options.apply };
}

export function posthogAppOrigin(host: string): string | null {
	let url: URL;
	try {
		url = new URL(host);
	} catch {
		return null;
	}
	if (url.protocol !== "https:" || url.username || url.password) return null;
	return APP_ORIGINS[url.hostname.toLowerCase()] ?? null;
}

function isPersonalApiKey(key: string): boolean {
	return /^phx_[A-Za-z0-9_-]+$/.test(key);
}

function hogqlString(name: string): string {
	if (!/^[a-z0-9_]+$/.test(name)) throw new Error("refusing to embed an unsafe property name");
	return `'${name}'`;
}

function eventOwnPresent(name: string): string {
	const key = hogqlString(name);
	return `JSONHas(properties, ${key}) OR JSONHas(properties, '$set', ${key}) OR JSONHas(properties, '$set_once', ${key})`;
}

export function eventMatchPredicate(): string {
	return POSTHOG_PURGE_PROPERTY_NAMES.map((name) => `(${eventOwnPresent(name)})`).join(" OR ");
}

function personMatchPredicate(): string {
	return POSTHOG_PURGE_PROPERTY_NAMES.map((name) => `JSONHas(properties, ${hogqlString(name)})`).join(" OR ");
}

export function eventCountQuery(): string {
	const columns = [
		`countIf(${eventMatchPredicate()}) AS matched`,
		...POSTHOG_PURGE_PROPERTY_NAMES.map((name, index) => `countIf(${eventOwnPresent(name)}) AS c${index}`),
	];
	return `SELECT ${columns.join(", ")} FROM events`;
}

export function personCountQuery(): string {
	const columns = [
		`countIf(${personMatchPredicate()}) AS matched`,
		...POSTHOG_PURGE_PROPERTY_NAMES.map(
			(name, index) => `countIf(JSONHas(properties, ${hogqlString(name)})) AS c${index}`,
		),
	];
	return `SELECT ${columns.join(", ")} FROM persons`;
}

export function eventDeletionQuery(): string {
	return `SELECT uuid FROM events WHERE ${eventMatchPredicate()}`;
}

export function personIdQuery(offset: number, limit = 500): string {
	if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) throw new Error("unsafe offset");
	if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("unsafe limit");
	return `SELECT toString(id) FROM persons WHERE ${personMatchPredicate()} LIMIT ${limit} OFFSET ${offset}`;
}

export function eventCountWidth(): number {
	return 1 + POSTHOG_PURGE_PROPERTY_NAMES.length;
}

export function personCountWidth(): number {
	return 1 + POSTHOG_PURGE_PROPERTY_NAMES.length;
}

export function purgeSubmissionId(names: readonly string[] = POSTHOG_PURGE_PROPERTY_NAMES): string {
	const bytes = fnvBytes(`envsync-posthog-value-purge\n${names.join("\n")}`);
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
	const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function fnvBytes(text: string): number[] {
	let state = 2166136261;
	const bytes: number[] = [];
	for (let round = 0; round < 4; round++) {
		let hash = state ^ round;
		for (let i = 0; i < text.length; i++) {
			hash ^= text.charCodeAt(i);
			hash = Math.imul(hash, 16777619);
		}
		bytes.push((hash >>> 24) & 0xff, (hash >>> 16) & 0xff, (hash >>> 8) & 0xff, hash & 0xff);
		state = hash >>> 0;
	}
	return bytes;
}

export function projectIdsFromList(body: unknown): number[] {
	if (!body || typeof body !== "object") return [];
	const results = (body as { results?: unknown }).results;
	if (!Array.isArray(results)) return [];
	const ids: number[] = [];
	for (const row of results) {
		if (!row || typeof row !== "object") continue;
		const id = (row as { id?: unknown }).id;
		if (typeof id === "number" && Number.isInteger(id) && id > 0) ids.push(id);
	}
	return ids;
}

/** One project on a single page. Does not follow `next` (that URL is not requested). */
export function soleProjectId(body: unknown): number | null {
	const ids = projectIdsFromList(body);
	if (ids.length !== 1 || !body || typeof body !== "object") return null;
	const page = body as { next?: unknown; count?: unknown };
	if (typeof page.next === "string" && page.next.length > 0) return null;
	if (typeof page.count === "number" && page.count !== 1) return null;
	return ids[0] ?? null;
}

function asCount(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
	if (typeof value === "string" && /^[0-9]+$/.test(value)) return Number(value);
	return null;
}

/** First HogQL row, count cells only. A non-count cell rejects the whole row. */
export function readCountRow(body: unknown, width: number): number[] | null {
	if (!body || typeof body !== "object") return null;
	const results = (body as { results?: unknown }).results;
	if (!Array.isArray(results) || results.length === 0) return null;
	const row = results[0];
	if (!Array.isArray(row) || row.length < width) return null;
	const counts: number[] = [];
	for (let i = 0; i < width; i++) {
		const count = asCount(row[i]);
		if (count === null) return null;
		counts.push(count);
	}
	return counts;
}

export function eventCountsFromRow(row: readonly number[]): {
	matched: number;
	properties: Record<string, number>;
} {
	const properties: Record<string, number> = {};
	POSTHOG_PURGE_PROPERTY_NAMES.forEach((name, index) => {
		properties[name] = row[1 + index] ?? 0;
	});
	return { matched: row[0] ?? 0, properties };
}

export function personCountsFromRow(row: readonly number[]): {
	matched: number;
	properties: Record<string, number>;
} {
	const properties: Record<string, number> = {};
	POSTHOG_PURGE_PROPERTY_NAMES.forEach((name, index) => {
		properties[name] = row[1 + index] ?? 0;
	});
	return { matched: row[0] ?? 0, properties };
}

export function personIdsFromQuery(body: unknown): string[] | null {
	if (!body || typeof body !== "object") return null;
	const results = (body as { results?: unknown }).results;
	if (!Array.isArray(results)) return null;
	const ids: string[] = [];
	for (const row of results) {
		if (!Array.isArray(row) || row.length < 1) return null;
		const id = row[0];
		if (typeof id !== "string" || !isPersonId(id)) return null;
		ids.push(id);
	}
	return ids;
}

function isPersonId(value: string): boolean {
	return PERSON_ID.test(value) || /^[0-9]{1,20}$/.test(value);
}

export function deletionReceipt(body: unknown): { id: string | null; status: string | null; count: number | null } {
	if (!body || typeof body !== "object") return { id: null, status: null, count: null };
	const row = body as Record<string, unknown>;
	const id = typeof row.id === "string" && PERSON_ID.test(row.id) ? row.id : null;
	const status = typeof row.status === "string" && DELETION_STATUSES.has(row.status) ? row.status : null;
	const count = typeof row.count === "number" && Number.isFinite(row.count) ? row.count : null;
	return { id, status, count };
}

export function personUnsetBody(): { $unset: string[] } {
	return { $unset: [...POSTHOG_PURGE_PROPERTY_NAMES] };
}

export function redactOperatorText(text: string): string {
	return text.replace(/phx_[A-Za-z0-9_-]+/g, "phx_<redacted>").replace(/phc_[A-Za-z0-9_-]+/g, "phc_<redacted>");
}

export function safeErrorDetail(body: unknown): string {
	if (!body || typeof body !== "object") return "request failed";
	const detail = (body as { detail?: unknown }).detail;
	const text = typeof detail === "string" ? detail : "request failed";
	return redactOperatorText(text).slice(0, 300);
}

export function purgeReport(input: {
	dryRun: boolean;
	applied: boolean;
	events: { matched: number; properties: Record<string, number> };
	persons: { matched: number; properties: Record<string, number>; unset?: number };
	eventDeletion?: { id: string | null; status: string | null; count: number | null } | null;
}): Record<string, unknown> {
	return {
		dry_run: input.dryRun,
		applied: input.applied,
		property_names: [...POSTHOG_PURGE_PROPERTY_NAMES],
		events: {
			matched: input.events.matched,
			properties: input.events.properties,
		},
		persons: {
			matched: input.persons.matched,
			properties: input.persons.properties,
			unset: input.persons.unset ?? 0,
		},
		event_deletion: input.eventDeletion ?? null,
	};
}

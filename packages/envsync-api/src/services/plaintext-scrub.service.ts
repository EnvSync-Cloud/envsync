import {
	AUDIT_VALUE_FIELD_NAMES,
	metadataOnlyAuditMessage,
	toMetadataOnlyAuditDetails,
} from "envsync-analytics";

import { ENV_PIT_SEALED_PREFIX, sealEnvPitValues } from "@/helpers/env-pit-value";
import {
	isSealedChangeRequestValue,
	sealChangeRequestValue,
} from "@/services/change_request_crypto";
import { AUDIT_GENESIS_HASH, computeAuditEntryHash } from "@/services/audit_log.service";
import { DB } from "@/libs/db";
import infoLogs, { LogTypes } from "@/libs/logger";
import { sql } from "kysely";

const VALUE_FIELDS = new Set<string>(AUDIT_VALUE_FIELD_NAMES);

export type PlaintextScrubReport = {
	dry_run: boolean;
	env_pit_values: number;
	env_pit_messages: number;
	secret_pit_messages: number;
	change_request_env_values: number;
	change_request_secret_values: number;
	audit_details: number;
	audit_messages: number;
	audit_rehashed: number;
	failed: number;
};

type PitValueRow = {
	id: string;
	key: string;
	value: string;
	org_id: string;
	app_id: string;
	env_type_id: string;
};

/**
 * Drop env values that older history messages embedded after the variable name.
 * The key and the action stay. A message with no embedded value is unchanged.
 */
export function scrubHistoryMessage(message: string): string {
	if (!message.includes("→") && !message.includes("(value:")) return message;

	let next = message.replace(
		/^(Updated environment variable: [^()]+?) \([\s\S]* → [\s\S]*\)$/,
		"$1",
	);
	next = next.replace(/^(Deleted environment variable: [^()]+?) \(value: [\s\S]*\)$/, "$1");
	next = next.replace(/^(Rollback variable \S+ to [\s\S]+?): [\s\S]* → [\s\S]*$/, "$1");
	next = next.replace(/:\s[^,]*→[^,]*/g, "");
	next = next.replace(/\s*\(value:\s[^)]*\)/g, "");
	return next;
}

function sortJson(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortJson);
	if (!value || typeof value !== "object") return value;
	return Object.keys(value as Record<string, unknown>)
		.sort()
		.reduce<Record<string, unknown>>((out, key) => {
			out[key] = sortJson((value as Record<string, unknown>)[key]);
			return out;
		}, {});
}

function stableJson(value: unknown) {
	return JSON.stringify(sortJson(value));
}

function collectValueFieldStrings(input: unknown, out: string[]) {
	if (Array.isArray(input)) {
		for (const item of input) collectValueFieldStrings(item, out);
		return;
	}
	if (!input || typeof input !== "object") return;
	for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
		if (VALUE_FIELDS.has(key.toLowerCase())) {
			if (typeof value === "string" && value.length >= 4) out.push(value);
			else collectValueFieldStrings(value, out);
			continue;
		}
		collectValueFieldStrings(value, out);
	}
}

export function scrubAuditDetails(details: string): {
	next: string;
	changed: boolean;
	removed: string[];
} {
	let parsed: unknown;
	try {
		parsed = JSON.parse(details);
	} catch {
		return { next: details, changed: false, removed: [] };
	}
	const removed: string[] = [];
	collectValueFieldStrings(parsed, removed);
	const cleaned = toMetadataOnlyAuditDetails(parsed);
	if (stableJson(cleaned) === stableJson(parsed)) {
		return { next: details, changed: false, removed };
	}
	return { next: JSON.stringify(cleaned), changed: true, removed };
}

export function scrubAuditMessage(message: string, removed: string[]) {
	let next = metadataOnlyAuditMessage(scrubHistoryMessage(message));
	const unique = [...new Set(removed)].sort((left, right) => right.length - left.length);
	for (const value of unique) {
		next = next.split(value).join("<redacted>");
	}
	return next;
}

function failure(scope: string, error: unknown) {
	const message = error instanceof Error ? error.message : "failed";
	infoLogs(`${scope}: ${message}`.slice(0, 300), LogTypes.ERROR, "PlaintextScrub");
}

export class PlaintextScrubService {
	static async run(options?: { dryRun?: boolean; orgId?: string }): Promise<PlaintextScrubReport> {
		const dryRun = options?.dryRun === true;
		const orgId = options?.orgId;
		const report: PlaintextScrubReport = {
			dry_run: dryRun,
			env_pit_values: 0,
			env_pit_messages: 0,
			secret_pit_messages: 0,
			change_request_env_values: 0,
			change_request_secret_values: 0,
			audit_details: 0,
			audit_messages: 0,
			audit_rehashed: 0,
			failed: 0,
		};
		const db = await DB.getInstance();

		await scrubEnvPitValues(db, dryRun, report, orgId);
		await scrubHistoryMessages(db, "env_store_pit", dryRun, report, "env_pit_messages", orgId);
		await scrubHistoryMessages(
			db,
			"secret_store_pit",
			dryRun,
			report,
			"secret_pit_messages",
			orgId,
		);
		await scrubChangeRequestValues(
			db,
			"change_request_env_item",
			dryRun,
			report,
			"change_request_env_values",
			orgId,
		);
		await scrubChangeRequestValues(
			db,
			"change_request_secret_item",
			dryRun,
			report,
			"change_request_secret_values",
			orgId,
		);
		await scrubAudit(db, dryRun, report, orgId);
		return report;
	}
}

async function scrubEnvPitValues(
	db: Awaited<ReturnType<typeof DB.getInstance>>,
	dryRun: boolean,
	report: PlaintextScrubReport,
	orgId?: string,
) {
	let query = db
		.selectFrom("env_store_pit_change_request")
		.innerJoin("env_store_pit", "env_store_pit.id", "env_store_pit_change_request.env_store_pit_id")
		.select([
			sql<string>`env_store_pit_change_request.id`.as("id"),
			sql<string>`env_store_pit_change_request.key`.as("key"),
			sql<string>`env_store_pit_change_request.value`.as("value"),
			sql<string>`env_store_pit.org_id`.as("org_id"),
			sql<string>`env_store_pit.app_id`.as("app_id"),
			sql<string>`env_store_pit.env_type_id`.as("env_type_id"),
		])
		.where("env_store_pit_change_request.value", "not like", `${ENV_PIT_SEALED_PREFIX}%`);
	if (orgId) query = query.where("env_store_pit.org_id", "=", orgId);
	const rows = (await query.execute()) as PitValueRow[];

	const groups = new Map<string, PitValueRow[]>();
	for (const row of rows) {
		const groupKey = `${row.org_id}\0${row.app_id}\0${row.env_type_id}`;
		const group = groups.get(groupKey) ?? [];
		group.push(row);
		groups.set(groupKey, group);
	}

	for (const group of groups.values()) {
		if (dryRun) {
			report.env_pit_values += group.length;
			continue;
		}
		try {
			const sealed = await sealEnvPitValues(
				group[0].org_id,
				group[0].app_id,
				group[0].env_type_id,
				group,
			);
			for (let index = 0; index < group.length; index++) {
				if (sealed[index].value === group[index].value) continue;
				await db
					.updateTable("env_store_pit_change_request")
					.set({ value: sealed[index].value, updated_at: new Date() })
					.where("id", "=", group[index].id)
					.execute();
				report.env_pit_values += 1;
			}
		} catch (error) {
			report.failed += group.length;
			failure(`env_store_pit_change_request ${group.length} rows`, error);
		}
	}
}

async function scrubHistoryMessages(
	db: Awaited<ReturnType<typeof DB.getInstance>>,
	table: "env_store_pit" | "secret_store_pit",
	dryRun: boolean,
	report: PlaintextScrubReport,
	countKey: "env_pit_messages" | "secret_pit_messages",
	orgId?: string,
) {
	let query = db
		.selectFrom(table)
		.select(["id", "change_request_message"])
		.where(eb =>
			eb.or([
				eb("change_request_message", "like", "%→%"),
				eb("change_request_message", "like", "%(value:%"),
			]),
		);
	if (orgId) query = query.where("org_id", "=", orgId);
	const rows = await query.execute();

	for (const row of rows) {
		const next = scrubHistoryMessage(row.change_request_message);
		if (next === row.change_request_message) continue;
		report[countKey] += 1;
		if (dryRun) continue;
		await db
			.updateTable(table)
			.set({ change_request_message: next, updated_at: new Date() })
			.where("id", "=", row.id)
			.execute();
	}
}

async function scrubChangeRequestValues(
	db: Awaited<ReturnType<typeof DB.getInstance>>,
	table: "change_request_env_item" | "change_request_secret_item",
	dryRun: boolean,
	report: PlaintextScrubReport,
	countKey: "change_request_env_values" | "change_request_secret_values",
	orgId?: string,
) {
	let query = db
		.selectFrom(table)
		.innerJoin("change_request", "change_request.id", `${table}.change_request_id`)
		.select([
			sql<string>`${sql.raw(table)}.id`.as("id"),
			sql<string | null>`${sql.raw(table)}.previous_value`.as("previous_value"),
			sql<string | null>`${sql.raw(table)}.proposed_value`.as("proposed_value"),
			sql<string>`change_request.org_id`.as("org_id"),
			sql<string>`change_request.app_id`.as("app_id"),
			sql<string>`${sql.raw(table)}.change_request_id`.as("change_request_id"),
		]);
	if (orgId) query = query.where("change_request.org_id", "=", orgId);
	const rows = await query.execute();

	for (const row of rows) {
		const previousNeedsSeal =
			row.previous_value != null && !isSealedChangeRequestValue(row.previous_value);
		const proposedNeedsSeal =
			row.proposed_value != null && !isSealedChangeRequestValue(row.proposed_value);
		if (!previousNeedsSeal && !proposedNeedsSeal) continue;
		report[countKey] += 1;
		if (dryRun) continue;
		try {
			const ref = {
				orgId: row.org_id,
				appId: row.app_id,
				changeRequestId: row.change_request_id,
				itemId: row.id,
			};
			const previous_value = previousNeedsSeal
				? await sealChangeRequestValue(ref, "previous", row.previous_value)
				: row.previous_value;
			const proposed_value = proposedNeedsSeal
				? await sealChangeRequestValue(ref, "proposed", row.proposed_value)
				: row.proposed_value;
			await db
				.updateTable(table)
				.set({ previous_value, proposed_value, updated_at: new Date() })
				.where("id", "=", row.id)
				.execute();
		} catch (error) {
			report[countKey] -= 1;
			report.failed += 1;
			failure(`${table} ${row.id}`, error);
		}
	}
}

async function scrubAudit(
	db: Awaited<ReturnType<typeof DB.getInstance>>,
	dryRun: boolean,
	report: PlaintextScrubReport,
	orgId?: string,
) {
	let orgQuery = db.selectFrom("audit_log").select("org_id").distinct();
	if (orgId) orgQuery = orgQuery.where("org_id", "=", orgId);
	const orgs = await orgQuery.execute();
	for (const org of orgs) {
		const rows = await db
			.selectFrom("audit_log")
			.select([
				"id",
				"org_id",
				"user_id",
				"action",
				"details",
				"message",
				"created_at",
				"previous_hash",
				"entry_hash",
			])
			.where("org_id", "=", org.org_id)
			.orderBy("created_at", "asc")
			.orderBy("id", "asc")
			.execute();

		let previous = AUDIT_GENESIS_HASH;
		let dirty = false;
		for (const row of rows) {
			const details = scrubAuditDetails(row.details ?? "");
			const message = scrubAuditMessage(row.message ?? "", details.removed);
			const messageChanged = message !== (row.message ?? "");
			if (details.changed || dirty) {
				const entryHash = computeAuditEntryHash(
					previous,
					new Date(row.created_at).toISOString(),
					row.action,
					row.org_id,
					row.user_id,
					details.next,
				);
				if (details.changed) report.audit_details += 1;
				else report.audit_rehashed += 1;
				if (messageChanged) report.audit_messages += 1;
				if (!dryRun) {
					await db
						.updateTable("audit_log")
						.set({
							details: details.next,
							message,
							previous_hash: previous,
							entry_hash: entryHash,
							updated_at: new Date(),
						})
						.where("id", "=", row.id)
						.execute();
				}
				previous = entryHash;
				dirty = true;
				continue;
			}
			if (messageChanged) {
				report.audit_messages += 1;
				if (!dryRun) {
					await db
						.updateTable("audit_log")
						.set({ message, updated_at: new Date() })
						.where("id", "=", row.id)
						.execute();
				}
			}
			previous = row.entry_hash || previous;
		}
	}
}

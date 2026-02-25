import { createHash } from "node:crypto";

import { STDBClient } from "@/libs/stdb";
import { WebhookService } from "./webhook.service";
import { z } from "zod";

export const ActionCategories = z.enum([
	'app*',
	'audit_log*',
	'env*',
	'env_store*',
	'secret_store*',
	'onboarding*',
	'org*',
	'role*',
	'user*',
	'api_key*',
	'webhook*',
	'cli*',
	'gpg_key*',
	'cert*',
]);

export type ActionCtgs = z.infer<typeof ActionCategories>;

export const ActionPastTimeOptions = z.enum([
	"last_3_hours",
	"last_24_hours",
	"last_7_days",
	"last_30_days",
	"last_90_days",
	"last_180_days",
	"last_1_year",
	"all_time"
]);

export type ActionPastTimes = z.infer<typeof ActionPastTimeOptions>;

// Genesis hash for the first entry in the audit chain (Issue #11)
const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Compute the hash for an audit entry.
 * hash = SHA256(previous_hash + timestamp + action + org_id + user_id + details)
 */
function computeEntryHash(
	previousHash: string,
	timestamp: string,
	action: string,
	orgId: string,
	userId: string,
	details: string,
): string {
	const data = previousHash + timestamp + action + orgId + userId + details;
	return createHash("sha256").update(data).digest("hex");
}

interface AuditLogRow {
	uuid: string;
	action: string;
	org_id: string;
	user_id: string;
	details: string;
	message: string;
	previous_hash: string | null;
	entry_hash: string | null;
	created_at: string;
	updated_at: string;
}

function mapAuditLogRow(row: AuditLogRow) {
	return {
		id: row.uuid,
		action: row.action,
		org_id: row.org_id,
		user_id: row.user_id,
		details: row.details,
		message: row.message,
		previous_hash: row.previous_hash,
		entry_hash: row.entry_hash,
		created_at: new Date(row.created_at),
		updated_at: new Date(row.updated_at),
	};
}

export class AuditLogService {
	public static notifyAuditSystem = async ({
		action,
		org_id,
		user_id,
		details,
		message,
	}: {
		details: Record<string, unknown>;
		action: AuditActions;
		org_id: string;
		user_id: string;
		message: string;
	}) => {
		const stdb = STDBClient.getInstance();
		const now = new Date();
		const timestamp = now.toISOString();
		const detailsStr = JSON.stringify(details);

		// Get the latest hash for the org to maintain the hash chain
		let previousHash = GENESIS_HASH;
		try {
			const latestEntry = await stdb.queryOne<{ entry_hash: string }>(
				`SELECT entry_hash FROM app_audit_log WHERE org_id = '${org_id}' AND entry_hash IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
			);
			if (latestEntry?.entry_hash) {
				previousHash = latestEntry.entry_hash;
			}
		} catch {
			// If entry_hash column doesn't exist yet, use genesis hash
		}

		const entryHash = computeEntryHash(
			previousHash,
			timestamp,
			action,
			org_id,
			user_id,
			detailsStr,
		);

		const id = crypto.randomUUID();
		await stdb.callReducer("create_audit_entry", [
			id,
			action,
			org_id,
			user_id,
			detailsStr,
			message,
			previousHash,
			entryHash,
		]);

		WebhookService.triggerWebhook({
			event_type: action,
			org_id: org_id || "",
			user_id: user_id || "",
			message: JSON.stringify(details || {}),
		}).catch(() => {});
	};

	public static getAuditLogs = async (
		org_id: string,
		{
			page,
			per_page,
			filter_by_user,
			filter_by_category,
			filter_by_past_time,
			}: {
				page: number;
				per_page: number;
				filter_by_user?: string;
				filter_by_category?: ActionCtgs;
				filter_by_past_time?: ActionPastTimes;
			},
	) => {
		const stdb = STDBClient.getInstance();
		const offset = (page - 1) * per_page;

		// Build WHERE clauses
		const conditions: string[] = [`org_id = '${org_id}'`];

		if (filter_by_user) {
			conditions.push(`user_id = '${filter_by_user}'`);
		}

		if (filter_by_category) {
			// Convert wildcard pattern like 'app*' to SQL LIKE pattern 'app%'
			const likePattern = filter_by_category.replace("*", "%");
			conditions.push(`action LIKE '${likePattern}'`);
		}

		if (filter_by_past_time) {
			const pastTime = new Date();
			switch (filter_by_past_time) {
				case "last_3_hours":
					pastTime.setHours(pastTime.getHours() - 3);
					break;
				case "last_24_hours":
					pastTime.setHours(pastTime.getHours() - 24);
					break;
				case "last_7_days":
					pastTime.setDate(pastTime.getDate() - 7);
					break;
				case "last_30_days":
					pastTime.setDate(pastTime.getDate() - 30);
					break;
				case "last_90_days":
					pastTime.setDate(pastTime.getDate() - 90);
					break;
				case "last_180_days":
					pastTime.setDate(pastTime.getDate() - 180);
					break;
				case "last_1_year":
					pastTime.setFullYear(pastTime.getFullYear() - 1);
					break;
				case "all_time":
					pastTime.setFullYear(0);
					break;
			}
			conditions.push(`created_at >= '${pastTime.toISOString()}'`);
		}

		const whereClause = conditions.join(" AND ");

		const [auditLogRows, countResult] = await Promise.all([
			stdb.query<AuditLogRow>(
				`SELECT * FROM app_audit_log WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${per_page} OFFSET ${offset}`,
			),
			stdb.queryCount(
				`SELECT uuid FROM app_audit_log WHERE ${whereClause}`,
			),
		]);

		const auditLogs = auditLogRows.map(mapAuditLogRow);
		const totalPages = Math.ceil(countResult / per_page);

		return {
			auditLogs,
			totalPages,
		};
	};
}

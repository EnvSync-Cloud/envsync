import { v4 as uuidv4 } from "uuid";
import { createHash } from "node:crypto";

import { DB } from "@/libs/db";
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
		const db = await DB.getInstance();

		const now = new Date();
		const timestamp = now.toISOString();
		const detailsStr = JSON.stringify(details);

		await db.transaction().execute(async (trx) => {
			// Lock the latest audit entry for this org to prevent concurrent hash chain forks
			let previousHash = GENESIS_HASH;
			try {
				const latestEntry = await trx
					.selectFrom("audit_log")
					.select("entry_hash")
					.where("org_id", "=", org_id)
					.where("entry_hash", "is not", null)
					.orderBy("created_at", "desc")
					.limit(1)
					.forUpdate()
					.executeTakeFirst();

				if (latestEntry?.entry_hash) {
					previousHash = latestEntry.entry_hash;
				}
			} catch {
				// If entry_hash column doesn't exist yet (pre-migration), use genesis hash
			}

			const entryHash = computeEntryHash(
				previousHash,
				timestamp,
				action,
				org_id,
				user_id,
				detailsStr,
			);

			await trx
				.insertInto("audit_log")
				.values({
					id: uuidv4(),
					action,
					org_id,
					user_id,
					details: detailsStr,
					message,
					previous_hash: previousHash,
					entry_hash: entryHash,
					created_at: now,
					updated_at: now,
				})
				.execute();
		});

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
		const db = await DB.getInstance();

		let auditLogsQuery = db
			.selectFrom("audit_log")
			.selectAll()
			.where("org_id", "=", org_id)
			.orderBy("created_at", "desc")
			.limit(per_page)
			.offset((page - 1) * per_page)

		let totalCountQuery = db
			.selectFrom("audit_log")
			.select(db.fn.count<number>("id").as("count"))
			.where("org_id", "=", org_id)

		if (filter_by_user) {
			auditLogsQuery = auditLogsQuery.where("user_id", "=", filter_by_user);
			totalCountQuery = totalCountQuery.where("user_id", "=", filter_by_user);
		}

		if (filter_by_category) {
			auditLogsQuery = auditLogsQuery.where("action", "like", filter_by_category.replace("*", "%"));
			totalCountQuery = totalCountQuery.where("action", "like", filter_by_category.replace("*", "%"));
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
			auditLogsQuery = auditLogsQuery.where("created_at", ">=", pastTime);
			totalCountQuery = totalCountQuery.where("created_at", ">=", pastTime);
		}

		const auditLogs = await auditLogsQuery.execute();
		const totalCount = await totalCountQuery.executeTakeFirstOrThrow();

		const totalPages = Math.ceil(totalCount.count / per_page);

		return {
			auditLogs,
			totalPages,
		};
	};
}

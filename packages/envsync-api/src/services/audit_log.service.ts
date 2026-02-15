import { v4 as uuidv4 } from "uuid";

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

export class AuditLogService {
	public static notifyAuditSystem = async ({
		action,
		org_id,
		user_id,
		details,
		message,
	}: {
		details: Record<string, any>;
		action: AuditActions;
		org_id: string;
		user_id: string;
		message: string;
	}) => {
		const db = await DB.getInstance();

		await db
			.insertInto("audit_log")
			.values({
				id: uuidv4(),
				action,
				org_id,
				user_id,
				details: JSON.stringify(details),
				message,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.execute();

		WebhookService.triggerWebhook({
			event_type: action, 
			org_id: org_id || "",
			user_id: user_id || "",
			message: JSON.stringify(details || {}),
		});
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

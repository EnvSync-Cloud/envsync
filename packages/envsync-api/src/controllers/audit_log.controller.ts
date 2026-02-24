import { type Context } from "hono";

import { AuditLogService, type ActionCtgs, type ActionPastTimes } from "@/services/audit_log.service";

export class AuditLogController {
	public static readonly getAuditLogs = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");

		const {
			page,
			per_page,
			filter_by_user,
			filter_by_category,
			filter_by_past_time,
		} = c.req.query();

		// filter_by_user, filter_by_category, and filter_by_past_time are optional
		const auditLogs = await AuditLogService.getAuditLogs(org_id, {
			page: Number(page) || 1,
			per_page: Number(per_page) || 25,
			filter_by_user: filter_by_user || undefined,
			filter_by_category: filter_by_category as ActionCtgs || undefined,
			filter_by_past_time: filter_by_past_time as ActionPastTimes || undefined,
		});

		// Log the retrieval of audit logs
		await AuditLogService.notifyAuditSystem({
			action: "get_audit_logs",
			user_id,
			org_id,
			message: `Retrieved audit logs.`,
			details: {
				page: Number(page) || 1,
				per_page: Number(per_page) || 25,
			},
		});

		return c.json(auditLogs);
	};
}

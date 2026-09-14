import { type Context } from "hono";

import { AuditLogService } from "@/services/audit_log.service";
import { ChangeRequestService } from "@/services/change_request.service";

export class ChangeRequestController {
	public static readonly createDirect = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const payload = await c.req.json();

		const request = await ChangeRequestService.createDirect({
			org_id,
			app_id: payload.app_id,
			target_env_type_id: payload.target_env_type_id,
			requested_by_user_id: user_id,
			title: payload.title,
			message: payload.message,
			envs: payload.envs,
			secrets: payload.secrets,
		});

		await AuditLogService.notifyAuditSystem({
			action: "change_request_created",
			org_id,
			user_id,
			message: `Change request created for ${payload.target_env_type_id}`,
			details: {
				change_request_id: request.id,
				target_env_type_id: payload.target_env_type_id,
				app_id: payload.app_id,
			},
		});

		return c.json(request, 201);
	};

	public static readonly createPromotion = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const payload = await c.req.json();

		const request = await ChangeRequestService.createPromotion({
			org_id,
			app_id: payload.app_id,
			source_env_type_id: payload.source_env_type_id,
			target_env_type_id: payload.target_env_type_id,
			requested_by_user_id: user_id,
			title: payload.title,
			message: payload.message,
		});

		await AuditLogService.notifyAuditSystem({
			action: "promotion_request_created",
			org_id,
			user_id,
			message: `Promotion request created from ${payload.source_env_type_id} to ${payload.target_env_type_id}`,
			details: {
				change_request_id: request.id,
				source_env_type_id: payload.source_env_type_id,
				target_env_type_id: payload.target_env_type_id,
				app_id: payload.app_id,
			},
		});

		return c.json(request, 201);
	};

	public static readonly list = async (c: Context) => {
		const org_id = c.get("org_id");
		const status = c.req.query("status");
		const app_id = c.req.query("app_id") || undefined;
		const requests = await ChangeRequestService.listChangeRequests(org_id, status, app_id);
		return c.json(requests, 200);
	};

	public static readonly get = async (c: Context) => {
		const org_id = c.get("org_id");
		const id = c.req.param("id");
		const request = await ChangeRequestService.getChangeRequest(id, org_id);
		return c.json(request, 200);
	};

	public static readonly approve = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const id = c.req.param("id");
		const request = await ChangeRequestService.approveChangeRequest({
			id,
			org_id,
			reviewer_user_id: user_id,
		});

		await AuditLogService.notifyAuditSystem({
			action: "change_request_approved",
			org_id,
			user_id,
			message: `Change request approved: ${id}`,
			details: { change_request_id: id },
		});

		if (request.request_kind === "promotion") {
			await AuditLogService.notifyAuditSystem({
				action: "promotion_request_applied",
				org_id,
				user_id,
				message: `Promotion request applied: ${id}`,
				details: { change_request_id: id },
			});
		}

		return c.json(request, 200);
	};

	public static readonly reject = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const id = c.req.param("id");
		const { rejection_reason } = await c.req.json();
		const request = await ChangeRequestService.rejectChangeRequest({
			id,
			org_id,
			reviewer_user_id: user_id,
			rejection_reason,
		});

		await AuditLogService.notifyAuditSystem({
			action: "change_request_rejected",
			org_id,
			user_id,
			message: `Change request rejected: ${id}`,
			details: { change_request_id: id, rejection_reason },
		});

		return c.json(request, 200);
	};

	public static readonly cancel = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const id = c.req.param("id");
		const request = await ChangeRequestService.cancelChangeRequest({
			id,
			org_id,
			requester_user_id: user_id,
		});

		await AuditLogService.notifyAuditSystem({
			action: "change_request_cancelled",
			org_id,
			user_id,
			message: `Change request cancelled: ${id}`,
			details: { change_request_id: id },
		});

		return c.json(request, 200);
	};
}

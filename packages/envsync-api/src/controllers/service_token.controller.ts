import { type Context } from "hono";

import { AuditLogService } from "@/services/audit_log.service";
import { ServiceTokenService } from "@/services/service_token.service";

export class ServiceTokenController {
	public static readonly createToken = async (c: Context) => {
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");

		const { name, app_id, env_type_id, permissions, expires_in_days } = await c.req.json();

		const result = await ServiceTokenService.createToken({
			org_id,
			created_by_user_id: user_id,
			name,
			app_id,
			env_type_id,
			permissions,
			expires_in_days,
		});

		await AuditLogService.notifyAuditSystem({
			action: "service_token_created",
			org_id,
			user_id,
			message: `Service token created: ${name}`,
			details: {
				service_token_id: result.id,
				name,
				app_id,
				env_type_id,
			},
		});

		return c.json(result, 201);
	};

	public static readonly getToken = async (c: Context) => {
		const id = c.req.param("id");
		const org_id = c.get("org_id");

		const token = await ServiceTokenService.getToken(id);

		if (token.org_id !== org_id) {
			return c.json({ error: "Service token not found" }, 404);
		}

		return c.json(token, 200);
	};

	public static readonly getAllTokens = async (c: Context) => {
		const org_id = c.get("org_id");
		const page = Math.max(1, Number(c.req.query("page")) || 1);
		const per_page = Math.min(100, Math.max(1, Number(c.req.query("per_page")) || 50));

		const tokens = await ServiceTokenService.getAllTokens(org_id, page, per_page);

		return c.json(tokens, 200);
	};

	public static readonly deleteToken = async (c: Context) => {
		const id = c.req.param("id");
		const org_id = c.get("org_id");

		const token = await ServiceTokenService.getToken(id);

		if (token.org_id !== org_id) {
			return c.json({ error: "Service token not found" }, 404);
		}

		await ServiceTokenService.deleteToken(id);

		await AuditLogService.notifyAuditSystem({
			action: "service_token_deleted",
			org_id,
			user_id: c.get("user_id"),
			message: `Service token deleted: ${id}`,
			details: { service_token_id: id },
		});

		return c.json({ message: "Service token deleted successfully." }, 200);
	};
}

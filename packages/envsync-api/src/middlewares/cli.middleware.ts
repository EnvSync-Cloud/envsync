import type { Context, MiddlewareHandler, Next } from "hono";

import { AuditLogService } from "@/services/audit_log.service";

export const cliMiddleware = (): MiddlewareHandler => {
	return async (ctx: Context, next: Next) => {
		try {
			const command = ctx.req.header("X-CLI-CMD");

			if (!command) {
				await next();
				return;
			}

			const user_id = ctx.get("user_id");
			const org_id = ctx.get("org_id");

			// Log the CLI command execution
			await AuditLogService.notifyAuditSystem({
				user_id,
				org_id,
				action: "cli_command_executed",
				message: `Executed CLI command: ${command}`,
				details: {
					command,
				},
			});

			await next();
		} catch (err) {
			if (err instanceof Error) {
				return ctx.json({ error: err.message }, 401);
			}
		}
	};
};

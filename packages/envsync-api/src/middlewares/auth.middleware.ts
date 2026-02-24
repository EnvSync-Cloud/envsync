import type { Context, MiddlewareHandler, Next } from "hono";
import { getCookie } from "hono/cookie";

import { getActiveSpan } from "@/libs/telemetry";
import { OrgService } from "@/services/org.service";
import { RoleService } from "@/services/role.service";
import { UserService } from "@/services/user.service";
import { validateAccess } from "@/helpers/access";

export const authMiddleware = (): MiddlewareHandler => {
	return async (ctx: Context, next: Next) => {
		let token =
			ctx.req.header("Authorization") ??
			ctx.req.query("access_token") ??
			getCookie(ctx, "access_token");

		let apiKey = ctx.req.header("X-API-Key") ?? ctx.req.query("api_key");

		// If neither token nor API key is provided, return an error
		// This is to ensure that at least one form of authentication is provided
		// If both are provided, the token will be prioritized
		if (!token && !apiKey) {
			return ctx.json({ error: "No token provided" }, 401);
		}

		try {
			const access_info = await validateAccess({
				token: token ? token.replace("Bearer ", "") : (apiKey ?? ""),
				type: token ? "JWT" : "API_KEY",
			});

			const user = await UserService.getUser(access_info.user_id);

			const [org, role] = await Promise.all([
				OrgService.getOrg(user.org_id),
				RoleService.getRole(user.role_id),
			]);

			ctx.set("user_id", user.id);
			ctx.set("keycloak_user_id", access_info.user_id); // IdP user id (Zitadel); key name kept for compatibility
			ctx.set("org_id", user.org_id);
			ctx.set("role_id", user.role_id);
			ctx.set("org_name", org.name);
			ctx.set("role_name", role.name);

			// Enrich active OTEL span with user context
			const span = getActiveSpan();
			if (span) {
				span.setAttributes({
					"envsync.user_id": user.id,
					"envsync.org_id": user.org_id,
					"envsync.org_name": org.name,
					"envsync.role_name": role.name,
					"enduser.id": access_info.user_id,
				});
			}

			await next();
		} catch (err) {
			if (err instanceof Error) {
				return ctx.json({ error: err.message }, 403);
			}
			return ctx.json({ error: "Authentication failed" }, 403);
		}
	};
};

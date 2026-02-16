import type { Context, MiddlewareHandler, Next } from "hono";

import { AuthorizationService } from "@/services/authorization.service";

/**
 * Middleware factory that checks if the authenticated user has a given
 * relation/permission on a resource before allowing the request through.
 *
 * @param relation - The FGA relation to check (e.g. "can_edit", "can_manage_apps")
 * @param objectType - The FGA object type (e.g. "org", "app", "env_type")
 * @param objectIdParam - Optional: name of a route param or JSON body field
 *   containing the resource ID. If omitted, defaults to the user's org_id.
 */
export const requirePermission = (
	relation: string,
	objectType: string,
	objectIdParam?: string,
): MiddlewareHandler => {
	return async (ctx: Context, next: Next) => {
		const userId = ctx.get("user_id");
		const orgId = ctx.get("org_id");

		if (!userId || !orgId) {
			return ctx.json({ error: "Authentication required." }, 401);
		}

		let objectId: string;

		if (!objectIdParam || objectIdParam === "org") {
			// Default to org-level check
			objectId = orgId;
		} else {
			// Try route params first, then query params
			objectId = ctx.req.param(objectIdParam) ?? ctx.req.query(objectIdParam) ?? "";

			if (!objectId) {
				// Try reading from JSON body (for POST/PATCH)
				try {
					const body = await ctx.req.json();
					objectId = body[objectIdParam] ?? "";
				} catch {
					// Body may not be JSON — that's fine
				}
			}
		}

		if (!objectId) {
			return ctx.json({ error: "Missing resource identifier for permission check." }, 400);
		}

		console.log("Checking permission:", userId, relation, objectType, objectId);

		const allowed = await AuthorizationService.check(userId, relation, objectType, objectId);
		console.log("Allowed:", allowed);

		if (!allowed) {
			return ctx.json({ error: "You do not have permission to perform this action." }, 403);
		}

		await next();
	};
};

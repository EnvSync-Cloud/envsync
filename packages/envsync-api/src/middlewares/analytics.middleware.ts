import type { MiddlewareHandler } from "hono";

import { analyticsContextFromRequest, runWithAnalyticsContext } from "@/libs/posthog";

export const analyticsContextMiddleware = (): MiddlewareHandler => {
	return async (ctx, next) => {
		const store = analyticsContextFromRequest({
			userAgent: ctx.req.header("user-agent"),
			clientHeader: ctx.req.header("x-envsync-client"),
			roleName: ctx.get("role_name") as string | undefined,
		});
		await runWithAnalyticsContext(store, next);
	};
};

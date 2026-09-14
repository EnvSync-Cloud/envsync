import type { Context, MiddlewareHandler, Next } from "hono";

import { ServiceTokenService } from "@/services/service_token.service";

function collectKeys(body: Record<string, unknown>, paramKey?: string): string[] {
	const keys: string[] = [];
	if (paramKey) keys.push(paramKey);
	if (typeof body.key === "string") keys.push(body.key);

	if (Array.isArray(body.keys)) {
		for (const key of body.keys) {
			if (typeof key === "string") keys.push(key);
		}
	}

	for (const field of ["envs", "secrets"] as const) {
		const items = body[field];
		if (!Array.isArray(items)) continue;
		for (const item of items) {
			if (item && typeof item === "object" && typeof (item as { key?: unknown }).key === "string") {
				keys.push((item as { key: string }).key);
			}
		}
	}

	return keys;
}

function isWriteRequest(ctx: Context): boolean {
	const method = ctx.req.method.toUpperCase();
	if (method === "PUT" || method === "PATCH" || method === "DELETE") return true;

	const path = ctx.req.path;
	return (
		path.includes("/delete") ||
		path.includes("/rollback") ||
		path.includes("/batch") ||
		path.includes("/single")
	);
}

function isKeylessAggregatePath(path: string): boolean {
	return (
		path.includes("/history") ||
		path.includes("/pit") ||
		path.includes("/timestamp") ||
		path.includes("/diff")
	);
}

export const serviceTokenScopeMiddleware = (): MiddlewareHandler => {
	return async (ctx: Context, next: Next) => {
		const token = ctx.get("service_token") as
			| {
					app_id: string | null;
					env_type_id?: string | null;
					permissions: Record<string, boolean>;
					scopes?: unknown;
			  }
			| undefined;

		if (!token) {
			await next();
			return;
		}

		let body: Record<string, unknown> = {};
		try {
			const parsed = await ctx.req.json();
			if (parsed && typeof parsed === "object") {
				body = parsed as Record<string, unknown>;
			}
		} catch {
			// GET-style routes may have no JSON body
		}

		const appId = typeof body.app_id === "string" ? body.app_id : ctx.req.param("app_id");
		const envTypeId =
			typeof body.env_type_id === "string" ? body.env_type_id : ctx.req.param("env_type_id");
		const pathKeyMatch = ctx.req.path.match(/\/i\/(.+)$/);
		const pathKey = pathKeyMatch ? decodeURIComponent(pathKeyMatch[1]) : undefined;
		const keys = collectKeys(body, ctx.req.param("key") ?? pathKey);
		const write = isWriteRequest(ctx);
		const allowKeyless = !write && !isKeylessAggregatePath(ctx.req.path);

		const denied = ServiceTokenService.getScopeDenial(token, {
			appId,
			envTypeId,
			paths: keys,
			permission: write ? "write" : "read",
			allowKeyless,
		});

		if (denied) {
			return ctx.json({ error: denied, code: "SERVICE_TOKEN_SCOPE_DENIED" }, 403);
		}

		await next();
	};
};

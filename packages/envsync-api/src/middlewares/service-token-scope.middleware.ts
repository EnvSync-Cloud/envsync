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

const WRITE_METHODS = new Set(["PUT", "PATCH", "DELETE"]);
const RESOURCE_PREFIX = /^\/api\/(?:env|secret)(?=\/|$)/;
const WRITE_TAILS = [/^\/single(?:\/|$)/, /^\/batch(?:\/|$)/, /^\/rollback(?:\/|$)/, /^\/delete(?:\/|$)/];
const KEYLESS_READ_TAILS = [/^\/history(?:\/|$)/, /^\/pit(?:\/|$)/, /^\/timestamp(?:\/|$)/, /^\/diff(?:\/|$)/];

function resourceTail(path: string): string {
	return path.replace(RESOURCE_PREFIX, "").split("?")[0] || "/";
}

export function classifyServiceTokenOp(method: string, path: string) {
	if (WRITE_METHODS.has(method.toUpperCase())) {
		return { permission: "write" as const, allowKeyless: false };
	}

	const tail = resourceTail(path);
	const write = WRITE_TAILS.some(pattern => pattern.test(tail));
	const keylessRead = KEYLESS_READ_TAILS.some(pattern => pattern.test(tail));
	return {
		permission: write ? ("write" as const) : ("read" as const),
		allowKeyless: !write && !keylessRead,
	};
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
			const parsed = await ctx.req.raw.clone().json();
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
		const op = classifyServiceTokenOp(ctx.req.method, ctx.req.path);

		const denied = ServiceTokenService.getScopeDenial(token, {
			appId,
			envTypeId,
			paths: keys,
			permission: op.permission,
			allowKeyless: op.allowKeyless,
		});

		if (denied) {
			return ctx.json({ error: denied, code: "SERVICE_TOKEN_SCOPE_DENIED" }, 403);
		}

		await next();
	};
};

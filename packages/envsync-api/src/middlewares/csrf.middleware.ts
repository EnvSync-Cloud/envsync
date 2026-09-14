import { timingSafeEqual } from "node:crypto";

import type { Context, MiddlewareHandler, Next } from "hono";
import { getCookie } from "hono/cookie";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_COOKIE = "envsync_csrf";

function usesHeaderAuth(ctx: Context) {
	return Boolean(ctx.req.header("Authorization") || ctx.req.header("X-API-Key"));
}

function isLogoutRequest(ctx: Context) {
	return ctx.req.path === "/api/access/web/logout";
}

function isPublicSamlPath(ctx: Context) {
	const path = ctx.req.path;
	return path.startsWith("/api/saml/acs") || path.startsWith("/api/saml/sso");
}

function csrfTokensMatch(cookie: string, header: string) {
	const cookieBytes = Buffer.from(cookie);
	const headerBytes = Buffer.from(header);
	if (cookieBytes.length === 0 || cookieBytes.length !== headerBytes.length) {
		return false;
	}
	return timingSafeEqual(cookieBytes, headerBytes);
}

export const csrfMiddleware = (): MiddlewareHandler => {
	return async (ctx: Context, next: Next) => {
		if (SAFE_METHODS.has(ctx.req.method) || usesHeaderAuth(ctx) || isLogoutRequest(ctx) || isPublicSamlPath(ctx)) {
			await next();
			return;
		}

		const accessToken = getCookie(ctx, "access_token");
		if (!accessToken) {
			await next();
			return;
		}

		const csrfCookie = getCookie(ctx, CSRF_COOKIE);
		const csrfHeader = ctx.req.header("X-CSRF-Token");
		if (!csrfCookie || !csrfHeader || !csrfTokensMatch(csrfCookie, csrfHeader)) {
			return ctx.json(
				{
					error: "CSRF token is missing or invalid",
					code: "AUTH_CSRF_INVALID",
				},
				403,
			);
		}

		await next();
	};
};

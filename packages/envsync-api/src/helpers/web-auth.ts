import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

import { config } from "@/utils/env";

const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";
const CSRF_COOKIE = "envsync_csrf";
const LOGIN_STATE_COOKIE = "envsync_login_state";
const ACTIVE_MEMBERSHIP_COOKIE = "envsync_active_membership";

type SameSitePolicy = "Lax" | "Strict" | "None";

export interface WebSessionTokens {
	access_token: string;
	refresh_token?: string;
	expires_in?: number;
	refresh_expires_in?: number;
	id_token?: string;
}

function shouldUseSecureCookies() {
	return config.NODE_ENV === "production" || config.DASHBOARD_URL.startsWith("https://");
}

function sharedCookieDomain() {
	try {
		const hostname = new URL(config.DASHBOARD_URL).hostname;
		if (hostname === "localhost" || /^[0-9.]+$/.test(hostname) || hostname.includes(":")) {
			return undefined;
		}

		const parts = hostname.split(".");
		if (parts.length < 3) {
			return undefined;
		}

		return `.${parts.slice(1).join(".")}`;
	} catch {
		return undefined;
	}
}

function cookieBaseOptions(path = "/api") {
	const domain = sharedCookieDomain();
	return {
		httpOnly: true,
		secure: shouldUseSecureCookies(),
		sameSite: "Lax" as SameSitePolicy,
		path,
		...(domain ? { domain } : {}),
	};
}

export function createCsrfToken() {
	return crypto.randomUUID();
}

export function readCsrfToken(c: Context) {
	return getCookie(c, CSRF_COOKIE);
}

export function readAccessToken(c: Context) {
	return getCookie(c, ACCESS_TOKEN_COOKIE);
}

export function readLoginState(c: Context) {
	return getCookie(c, LOGIN_STATE_COOKIE);
}

export function readActiveMembershipCookie(c: Context) {
	return getCookie(c, ACTIVE_MEMBERSHIP_COOKIE);
}

export function readRefreshToken(c: Context) {
	return getCookie(c, REFRESH_TOKEN_COOKIE);
}

export function clearWebAuthCookies(c: Context) {
	const csrfDomain = sharedCookieDomain();

	for (const cookieName of [
		ACCESS_TOKEN_COOKIE,
		REFRESH_TOKEN_COOKIE,
		CSRF_COOKIE,
		LOGIN_STATE_COOKIE,
		ACTIVE_MEMBERSHIP_COOKIE,
	]) {
		deleteCookie(c, cookieName, { path: "/" });
		deleteCookie(c, cookieName, { path: "/api" });
		if (cookieName === CSRF_COOKIE && csrfDomain) {
			deleteCookie(c, cookieName, { path: "/", domain: csrfDomain });
		}
	}
}

export function setLoginStateCookie(c: Context, state: string) {
	setCookie(c, LOGIN_STATE_COOKIE, state, {
		...cookieBaseOptions("/api"),
		maxAge: 10 * 60,
	});
}

export function setActiveMembershipCookie(c: Context, userId: string, maxAge = 7 * 24 * 60 * 60) {
	setCookie(c, ACTIVE_MEMBERSHIP_COOKIE, userId, {
		...cookieBaseOptions("/api"),
		maxAge,
	});
}

export function setWebAuthCookies(c: Context, tokens: WebSessionTokens) {
	const csrfToken = createCsrfToken();
	const csrfDomain = sharedCookieDomain();

	setCookie(c, ACCESS_TOKEN_COOKIE, tokens.access_token, {
		...cookieBaseOptions("/api"),
		maxAge: Math.max(tokens.expires_in ?? 900, 60),
	});

	if (tokens.refresh_token) {
		setCookie(c, REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
			...cookieBaseOptions("/api"),
			maxAge: Math.max(tokens.refresh_expires_in ?? 7 * 24 * 60 * 60, 60),
		});
	}

	setCookie(c, CSRF_COOKIE, csrfToken, {
		httpOnly: false,
		secure: shouldUseSecureCookies(),
		sameSite: "Lax",
		path: "/",
		...(csrfDomain ? { domain: csrfDomain } : {}),
		maxAge: Math.max(tokens.refresh_expires_in ?? 7 * 24 * 60 * 60, 60),
	});

	deleteCookie(c, LOGIN_STATE_COOKIE, { path: "/api" });
}

import type { Context, MiddlewareHandler, Next } from "hono";
import { getCookie } from "hono/cookie";

import {
	clearWebAuthCookies,
	readActiveMembershipCookie,
	setActiveMembershipCookie,
	setWebAuthCookies,
} from "@/helpers/web-auth";
import { AppError } from "@/libs/errors";
import { config } from "@/utils/env";
import { getActiveSpan } from "@/libs/telemetry";
import { OrgService } from "@/services/org.service";
import { RoleService } from "@/services/role.service";
import { SystemCertificateProvisioningService } from "@/services/system-certificate-provisioning.service";
import { UserService } from "@/services/user.service";
import { validateAccess, detectAuthType } from "@/helpers/access";
import { keycloakRefreshToken } from "@/helpers/keycloak";

function isQueryCredentialAttempt(ctx: Context) {
	return Boolean(ctx.req.query("access_token") || ctx.req.query("api_key"));
}

export const authMiddleware = (): MiddlewareHandler => {
	return async (ctx: Context, next: Next) => {
		if (isQueryCredentialAttempt(ctx)) {
			return ctx.json(
				{
					error: "Query-string credentials are not supported",
					code: "AUTH_QUERY_UNSUPPORTED",
				},
				400,
			);
		}

		let token = ctx.req.header("Authorization") ?? getCookie(ctx, "access_token");
		const refreshToken = getCookie(ctx, "refresh_token");
		const apiKey = ctx.req.header("X-API-Key");
		const authorizationHeader = ctx.req.header("Authorization");
		const usesCookieSession = !authorizationHeader && Boolean(token);
		const usesBearerToken = Boolean(authorizationHeader && token);
		const requestedOrgHeader = ctx.req.header("X-EnvSync-Org-Id");

		if (!token && !apiKey) {
			return ctx.json({ error: "No token provided", code: "AUTH_MISSING" }, 401);
		}

		// Determine if this is an OIDC token or a Keycloak JWT
		const authType = usesBearerToken && token ? detectAuthType(token) : "JWT";

		const resolveJwt = async (jwtToken: string) => validateAccess({
			token: jwtToken.replace("Bearer ", ""),
			type: authType,
		});

		try {
			let access_info: Awaited<ReturnType<typeof validateAccess>>;
			if (token) {
				try {
					access_info = await resolveJwt(token);
				} catch (jwtError) {
					// OIDC tokens don't support refresh — fail immediately
					if (authType === "OIDC") {
						return ctx.json(
							{
								error: jwtError instanceof Error ? jwtError.message : "OIDC authentication failed",
								code: "AUTH_OIDC_INVALID",
							},
							401,
						);
					}

					if (!usesCookieSession || !refreshToken) {
						throw jwtError;
					}

					try {
						const refreshed = await keycloakRefreshToken(
							refreshToken,
							config.KEYCLOAK_WEB_CLIENT_ID,
							config.KEYCLOAK_WEB_CLIENT_SECRET,
						);
						setWebAuthCookies(ctx, refreshed);
						token = refreshed.access_token;
						access_info = await resolveJwt(token);
					} catch {
						clearWebAuthCookies(ctx);
						return ctx.json(
							{
								error: "Session expired. Sign in again.",
								code: "AUTH_RELOGIN_REQUIRED",
							},
							401,
						);
					}
				}
			} else {
				access_info = await validateAccess({
					token: apiKey ?? "",
					type: "API_KEY",
				});
			}

			let user = await UserService.getUser(access_info.user_id);
			if (usesCookieSession && access_info.auth_service_id) {
				const requestedMembershipId = readActiveMembershipCookie(ctx);
				user = await UserService.resolveActiveMembershipByIdpId(
					access_info.auth_service_id,
					requestedMembershipId,
				);

				if (requestedMembershipId && requestedMembershipId !== user.id) {
					await UserService.touchLastLogin(user.id);
					setActiveMembershipCookie(ctx, user.id);
				}
			} else if (usesBearerToken && access_info.auth_service_id && requestedOrgHeader !== undefined) {
				const requestedOrgId = requestedOrgHeader.trim();
				if (!requestedOrgId) {
					throw new AppError(
						"X-EnvSync-Org-Id must not be blank.",
						400,
						"AUTH_ORG_HEADER_INVALID",
					);
				}

				user = await UserService.resolveMembershipByOrgId(
					access_info.auth_service_id,
					requestedOrgId,
				);
			}

			const [org, role] = await Promise.all([
				OrgService.getOrg(user.org_id),
				RoleService.getRole(user.role_id),
			]);

			ctx.set("user_id", user.id);
			ctx.set("keycloak_user_id", access_info.auth_service_id ?? access_info.user_id);
			ctx.set("org_id", user.org_id);
			ctx.set("role_id", user.role_id);
			ctx.set("org_name", org.name);
			ctx.set("role_name", role.name);

			await SystemCertificateProvisioningService.ensureProvisionedForAuthenticatedUser(
				user.id,
				user.org_id,
				user.role_id,
			);

			const span = getActiveSpan();
			if (span) {
				span.setAttributes({
					"envsync.user_id": user.id,
					"envsync.org_id": user.org_id,
					"envsync.org_name": org.name,
					"envsync.role_name": role.name,
					"envsync.auth_type": access_info.auth_type,
					"enduser.id": access_info.auth_service_id ?? access_info.user_id,
				});
			}

			await next();
		} catch (err) {
			if (err instanceof AppError && err.statusCode !== 404) {
				throw err;
			}
			if (err instanceof Error) {
				if (usesCookieSession) {
					clearWebAuthCookies(ctx);
					return ctx.json({ error: "Session invalid. Sign in again.", code: "AUTH_RELOGIN_REQUIRED" }, 401);
				}
				return ctx.json({ error: err.message, code: token ? "AUTH_INVALID" : "AUTH_API_KEY_INVALID" }, 401);
			}
			return ctx.json({ error: "Authentication failed", code: "AUTH_INVALID" }, 401);
		}
	};
};

import type { Context, MiddlewareHandler, Next } from "hono";
import { getCookie } from "hono/cookie";

import {
	clearWebAuthCookies,
	readActiveMembershipCookie,
	setActiveMembershipCookie,
	setWebAuthCookies,
} from "@/helpers/web-auth";
import { AppError } from "@/libs/errors";
import infoLogs, { LogTypes } from "@/libs/logger";
import { config } from "@/utils/env";
import { getActiveSpan } from "@/libs/telemetry";
import { OrgService } from "@/services/org.service";
import { RoleService } from "@/services/role.service";
import { SystemCertificateProvisioningService } from "@/services/system-certificate-provisioning.service";
import { UserService } from "@/services/user.service";
import { validateAccess, detectAuthType } from "@/helpers/access";
import { decodeJwt } from "jose";

import {
	confirmationThumbprint,
	defaultDeviceLabel,
	readUnverifiedClientId,
	requestProofUrls,
	sessionClientRequiresDpop,
	verifyDpopProof,
} from "@/helpers/dpop";
import { SessionDeviceService } from "@/services/session-device.service";
import { refreshDirectoryToken } from "@/helpers/identity";
import { isServiceTokenAllowedPath } from "@/middlewares/service-token-scope.middleware";

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
		const presentedToken = () => (token ?? "").replace(/^(?:Bearer|DPoP)\s+/i, "");
		const refreshToken = getCookie(ctx, "refresh_token");
		const apiKey = ctx.req.header("X-API-Key");
		const authorizationHeader = ctx.req.header("Authorization");
		const usesCookieSession = !authorizationHeader && Boolean(token);
		const usesBearerToken = Boolean(authorizationHeader && token);
		const usesBrowserSession = Boolean(getCookie(ctx, "access_token") || refreshToken);
		const requestedOrgHeader = ctx.req.header("X-EnvSync-Org-Id");

		if (!token && !apiKey) {
			return ctx.json({ error: "No token provided", code: "AUTH_MISSING" }, 401);
		}

		const verifyAs = token ? detectAuthType(token) : "API_KEY";

		const resolveCredential = async (rawToken: string) =>
			validateAccess({
				token: rawToken.replace(/^(?:Bearer|DPoP)\s+/i, ""),
				type: verifyAs,
			});

		try {
			let access_info: Awaited<ReturnType<typeof validateAccess>>;
			if (token) {
				try {
					access_info = await resolveCredential(token);
				} catch (jwtError) {
					if (verifyAs === "OIDC") {
						return ctx.json(
							{
								error: jwtError instanceof Error ? jwtError.message : "OIDC authentication failed",
								code: "AUTH_OIDC_INVALID",
							},
							401,
						);
					}

					if (verifyAs === "SAML") {
						if (usesCookieSession) {
							clearWebAuthCookies(ctx);
							return ctx.json(
								{
									error: "Session expired. Sign in again.",
									code: "AUTH_RELOGIN_REQUIRED",
								},
								401,
							);
						}
						throw jwtError;
					}

					if (
						!usesCookieSession ||
						!refreshToken ||
						sessionClientRequiresDpop(readUnverifiedClientId(presentedToken()))
					) {
						throw jwtError;
					}

					try {
						const refreshed = await refreshDirectoryToken(
							refreshToken,
							config.ATRIUM_WEB_CLIENT_ID,
							config.ATRIUM_WEB_CLIENT_SECRET,
						);
						setWebAuthCookies(ctx, refreshed);
						token = refreshed.access_token;
						access_info = await resolveCredential(token);
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

			let dpopJkt = "";
			let dpopSub = "";
			let dpopClientId = "";
			if (verifyAs === "JWT") {
				// Mock suites authenticate with "test-token-..." rather than a compact JWT.
				// Those tokens have already passed validateAccess. DPoP applies only when
				// the presented credential is a session JWT we can read.
				let payload: Record<string, unknown> | null = null;
				try {
					payload = decodeJwt(presentedToken()) as Record<string, unknown>;
				} catch {
					payload = null;
				}
				if (payload) {
					const jkt = confirmationThumbprint(payload);
					dpopJkt = jkt;
					dpopSub = typeof payload.sub === "string" ? payload.sub : "";
					dpopClientId = typeof payload.client_id === "string" ? payload.client_id : "";
					if (sessionClientRequiresDpop(payload.client_id)) {
						if (!jkt) {
							return ctx.json(
								{
									error: "Session is not bound to a device key. Sign in again.",
									code: "DPOP_REQUIRED",
								},
								401,
							);
						}
						await verifyDpopProof({
							proof: ctx.req.header("DPoP") ?? "",
							method: ctx.req.method,
							url: ctx.req.url,
							urls: requestProofUrls(ctx.req.url),
							accessToken: presentedToken(),
							expectedJkt: jkt,
						});
						await SessionDeviceService.assertActive(dpopSub, jkt);
					}
					ctx.set("dpop_jkt", jkt);
				}
			}

			let user = await UserService.getUser(access_info.user_id);
			if (verifyAs !== "SAML" && usesBrowserSession && access_info.auth_service_id) {
				const requestedMembershipId = readActiveMembershipCookie(ctx);
				user = await UserService.resolveActiveMembershipByIdpId(
					access_info.auth_service_id,
					requestedMembershipId,
				);

				if (requestedMembershipId && requestedMembershipId !== user.id) {
					await UserService.touchLastLogin(user.id);
					setActiveMembershipCookie(ctx, user.id);
				}
			} else if (
				verifyAs !== "SAML" &&
				usesBearerToken &&
				access_info.auth_service_id &&
				requestedOrgHeader !== undefined
			) {
				const requestedOrgId = requestedOrgHeader.trim();
				if (!requestedOrgId) {
					throw new AppError("X-EnvSync-Org-Id must not be blank.", 400, "AUTH_ORG_HEADER_INVALID");
				}

				user = await UserService.resolveMembershipByOrgId(
					access_info.auth_service_id,
					requestedOrgId,
				);
			}

			if (dpopJkt && dpopSub) {
				try {
					await SessionDeviceService.touch(
						{
							directoryUserId: dpopSub,
							userId: user.id,
							clientId: dpopClientId,
							jkt: dpopJkt,
							label: defaultDeviceLabel(dpopClientId, ctx.req.header("user-agent")),
						},
						{ createIfMissing: false },
					);
				} catch (error) {
					if (error instanceof AppError) throw error;
					infoLogs(
						`Session device touch failed: ${error instanceof Error ? error.message : String(error)}`,
						LogTypes.ERROR,
						"AuthMiddleware",
					);
				}
			}

			const [org, role] = await Promise.all([
				OrgService.getOrg(user.org_id),
				RoleService.getRole(user.role_id),
			]);

			ctx.set("user_id", user.id);
			ctx.set("directory_user_id", access_info.auth_service_id ?? access_info.user_id);
			ctx.set("org_id", user.org_id);
			ctx.set("role_id", user.role_id);
			ctx.set("org_name", org.name);
			ctx.set("role_name", role.name);
			ctx.set(
				"auth_type",
				(
					{
						JWT: "jwt",
						SAML: "saml",
						OIDC: "oidc",
						API_KEY: "api_key",
						SERVICE_TOKEN: "service_token",
					} as const
				)[access_info.auth_type],
			);
			if (access_info.service_token) {
				ctx.set("service_token", access_info.service_token);
			}

			if (access_info.auth_type === "SERVICE_TOKEN" && !isServiceTokenAllowedPath(ctx.req.path)) {
				return ctx.json(
					{
						error: "Service tokens can only access environment and secret APIs",
						code: "SERVICE_TOKEN_ROUTE_DENIED",
					},
					403,
				);
			}

			try {
				await SystemCertificateProvisioningService.ensureProvisionedForAuthenticatedUser(
					user.id,
					user.org_id,
					user.role_id,
				);
			} catch (error) {
				infoLogs(
					`System member cert not provisioned for ${user.id}: ${error instanceof Error ? error.message : String(error)}`,
					LogTypes.ERROR,
					"AuthMiddleware",
				);
			}

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
					return ctx.json(
						{ error: "Session invalid. Sign in again.", code: "AUTH_RELOGIN_REQUIRED" },
						401,
					);
				}
				return ctx.json(
					{ error: err.message, code: token ? "AUTH_INVALID" : "AUTH_API_KEY_INVALID" },
					401,
				);
			}
			return ctx.json({ error: "Authentication failed", code: "AUTH_INVALID" }, 401);
		}
	};
};

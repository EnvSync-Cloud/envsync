import { type Context } from "hono";
import { decodeJwt } from "jose";
import * as openid from "openid-client";

import { config } from "@/utils/env";
import {
	type IdentityTokenSet,
	exchangeAuthorizationCode,
	getIdentityIssuer,
	passwordGrantLogin,
	publicTokenEndpoint,
	refreshDirectoryToken,
	revokeDirectoryToken,
} from "@/helpers/identity";
import { detectAuthType } from "@/helpers/access";
import {
	confirmationThumbprint,
	defaultDeviceLabel,
	deviceLabel,
	requestProofUrls,
	verifyDpopProof,
} from "@/helpers/dpop";
import {
	clearWebAuthCookies,
	readAccessToken,
	readIdToken,
	readLoginState,
	readRefreshToken,
	setActiveMembershipCookie,
	setLoginStateCookie,
	setWebAuthCookies,
} from "@/helpers/web-auth";
import { UserService } from "@/services/user.service";
import { SessionDeviceService } from "@/services/session-device.service";
import { verifyJWTToken } from "@/helpers/jwt";
import { AppError } from "@/libs/errors";
import infoLogs, { LogTypes } from "@/libs/logger";

const directoryDiscoveryUrl = () => `${getIdentityIssuer()}/.well-known/openid-configuration`;
const authorizeEndpoint = () => `${getIdentityIssuer()}/oauth/authorize`;

const clientMetadata: openid.ClientMetadata = {
	client_id: config.ATRIUM_CLI_CLIENT_ID,
	redirect_uris: [],
};
const clientAuth: openid.ClientAuth = openid.None();

export class AccessController {
	private static assertDevSessionAllowed() {
		if (config.NODE_ENV === "production") {
			throw new Error("Local dev session bootstrap is disabled in production");
		}
	}

	private static async setActiveMembershipFromAccessToken(c: Context, accessToken: string) {
		const decoded = await verifyJWTToken(accessToken);
		const authServiceId = typeof decoded.sub === "string" ? decoded.sub : "";
		if (!authServiceId) {
			return undefined;
		}

		const user = await UserService.resolveActiveMembershipByIdpId(authServiceId);
		await UserService.touchLastLogin(user.id);
		setActiveMembershipCookie(c, user.id);
		return user.id;
	}

	private static async bindBrowserSession(
		c: Context,
		tokenData: IdentityTokenSet,
		proofJkt: string,
		label: string,
	) {
		const verified = await verifyJWTToken(tokenData.access_token);
		const payload = verified as Record<string, unknown>;
		const jkt = confirmationThumbprint(payload);
		const directoryUserId = typeof verified.sub === "string" ? verified.sub : "";
		if (!jkt || jkt !== proofJkt || !directoryUserId) {
			throw new AppError(
				"Session is not bound to a device key. Sign in again.",
				401,
				"DPOP_REQUIRED",
			);
		}

		const user = await UserService.resolveActiveMembershipByIdpId(directoryUserId);
		await SessionDeviceService.touch({
			directoryUserId,
			userId: user.id,
			clientId: config.ATRIUM_WEB_CLIENT_ID,
			jkt,
			label,
		});
		await UserService.touchLastLogin(user.id);
		setActiveMembershipCookie(c, user.id);
		setWebAuthCookies(c, tokenData, { includeAccessToken: false });

		return {
			access_token: tokenData.access_token,
			expires_in: tokenData.expires_in,
			token_type: tokenData.token_type || "DPoP",
		};
	}

	private static logTokenFailure(error: unknown) {
		const message = error instanceof Error ? error.message : "unknown";
		infoLogs(
			message.replace(/access_token[^,\s]*/gi, "access_token=[redacted]").slice(0, 300),
			LogTypes.ERROR,
			"AccessController",
		);
	}

	public static readonly createCliLogin = async (c: Context) => {
		const { ATRIUM_CLI_CLIENT_ID } = config;

		const authConfig: openid.Configuration = await openid.discovery(
			new URL(directoryDiscoveryUrl()),
			ATRIUM_CLI_CLIENT_ID,
			clientMetadata,
			clientAuth,
			{
				execute: [openid.allowInsecureRequests],
			},
		);

		const deviceAuthInit = await openid.initiateDeviceAuthorization(authConfig, {
			scope: "openid email profile",
		});

		return c.json(
			{
				message: "CLI login created successfully.",
				verification_uri_complete: deviceAuthInit.verification_uri_complete,
				user_code: deviceAuthInit.user_code,
				device_code: deviceAuthInit.device_code,
				expires_in: deviceAuthInit.expires_in,
				interval: deviceAuthInit.interval,
				client_id: ATRIUM_CLI_CLIENT_ID,
				token_url: authConfig.serverMetadata().token_endpoint,
			},
			201,
		);
	};

	public static readonly registerCliSession = async (c: Context) => {
		const authorization = c.req.header("Authorization") ?? "";
		const accessToken = authorization.replace(/^(?:Bearer|DPoP)\s+/i, "").trim();
		if (!accessToken) {
			return c.json({ error: "No token provided", code: "AUTH_MISSING" }, 401);
		}

		let payload: Record<string, unknown>;
		try {
			payload = (await verifyJWTToken(accessToken)) as Record<string, unknown>;
		} catch (error) {
			if (error instanceof AppError) throw error;
			return c.json({ error: "Session is not valid. Sign in again.", code: "AUTH_INVALID" }, 401);
		}

		const clientId = typeof payload.client_id === "string" ? payload.client_id : "";
		if (clientId !== config.ATRIUM_CLI_CLIENT_ID) {
			return c.json(
				{ error: "Device registration requires a CLI session.", code: "DPOP_INVALID" },
				401,
			);
		}

		const jkt = confirmationThumbprint(payload);
		const directoryUserId = typeof payload.sub === "string" ? payload.sub : "";
		if (!jkt || !directoryUserId) {
			throw new AppError(
				"Session is not bound to a device key. Sign in again.",
				401,
				"DPOP_REQUIRED",
			);
		}

		await verifyDpopProof({
			proof: c.req.header("DPoP") ?? "",
			method: "POST",
			url: c.req.url,
			urls: requestProofUrls(c.req.url),
			accessToken,
			expectedJkt: jkt,
		});

		let userId: string | null = null;
		try {
			const user = await UserService.resolveActiveMembershipByIdpId(directoryUserId);
			userId = user.id;
		} catch (error) {
			if (error instanceof AppError) throw error;
			userId = null;
		}

		await SessionDeviceService.touch({
			directoryUserId,
			userId,
			clientId,
			jkt,
			label: defaultDeviceLabel(clientId, c.req.header("user-agent")),
		});

		return c.json({ registered: true }, 200);
	};

	public static readonly createWebLogin = async (c: Context) => {
		const { ATRIUM_WEB_CLIENT_ID, ATRIUM_WEB_CALLBACK_URL } = config;
		const state = crypto.randomUUID();
		setLoginStateCookie(c, state);

		const loginUrl = `${authorizeEndpoint()}?client_id=${ATRIUM_WEB_CLIENT_ID}&response_type=code&scope=openid%20email%20profile&redirect_uri=${encodeURIComponent(ATRIUM_WEB_CALLBACK_URL)}&state=${encodeURIComponent(state)}`;

		return c.json({ message: "Web login created successfully.", loginUrl }, 201);
	};

	public static readonly createDevWebSession = async (c: Context) => {
		this.assertDevSessionAllowed();

		const email = c.req.query("email");
		const password = c.req.query("password");
		if (!email || !password) {
			return c.json({ error: "email and password are required" }, 400);
		}

		try {
			const clientId = config.ATRIUM_E2E_CLIENT_ID;
			const clientSecret = config.ATRIUM_E2E_CLIENT_SECRET;
			if (!clientId || !clientSecret) {
				return c.json(
					{ error: "Dev session requires the e2e client.", code: "DEV_SESSION_UNAVAILABLE" },
					400,
				);
			}
			const tokenData = await passwordGrantLogin(email, password, clientId, clientSecret);
			setWebAuthCookies(c, tokenData);
			await this.setActiveMembershipFromAccessToken(c, tokenData.access_token);
			return c.json({ message: "Local web session created." }, 200);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return c.json(
				{
					error: "Local dev session bootstrap failed.",
					detail: message,
				},
				500,
			);
		}
	};

	public static readonly callbackWebLogin = async (c: Context) => {
		return c.json(
			{
				error: "Sign-in now finishes in the dashboard. Start again from the login page.",
				code: "WEB_CALLBACK_MOVED",
			},
			400,
		);
	};

	public static readonly exchangeWebLogin = async (c: Context) => {
		const body = (await c.req.json().catch(() => null)) as {
			code?: unknown;
			state?: unknown;
			device_label?: unknown;
		} | null;
		const code = typeof body?.code === "string" ? body.code : "";
		const state = typeof body?.state === "string" ? body.state : "";
		if (!code || !state) {
			return c.json({ error: "Code and state are required.", code: "BAD_REQUEST" }, 400);
		}

		const expectedState = readLoginState(c);
		if (!expectedState || state !== expectedState) {
			clearWebAuthCookies(c);
			return c.json({ error: "Invalid login state.", code: "LOGIN_STATE_INVALID" }, 400);
		}

		try {
			const proof = c.req.header("DPoP") ?? "";
			const proofJkt = await verifyDpopProof({
				proof,
				method: "POST",
				url: publicTokenEndpoint(),
				accessToken: "",
			});
			const tokenData = await exchangeAuthorizationCode(
				code,
				config.ATRIUM_WEB_CALLBACK_URL,
				config.ATRIUM_WEB_CLIENT_ID,
				config.ATRIUM_WEB_CLIENT_SECRET,
				proof,
			);
			const session = await this.bindBrowserSession(
				c,
				tokenData,
				proofJkt,
				deviceLabel(body?.device_label, "Browser"),
			);
			return c.json({ message: "Web login completed.", ...session }, 200);
		} catch (error) {
			if (error instanceof AppError) throw error;
			this.logTokenFailure(error);
			clearWebAuthCookies(c);
			return c.json(
				{ error: "Sign-in could not be completed. Start again.", code: "DPOP_EXCHANGE_FAILED" },
				401,
			);
		}
	};

	public static readonly refreshWebSession = async (c: Context) => {
		const refreshToken = readRefreshToken(c);
		if (!refreshToken) {
			return c.json(
				{ error: "Session expired. Sign in again.", code: "AUTH_RELOGIN_REQUIRED" },
				401,
			);
		}

		const body = (await c.req.json().catch(() => null)) as { device_label?: unknown } | null;
		try {
			const proof = c.req.header("DPoP") ?? "";
			const proofJkt = await verifyDpopProof({
				proof,
				method: "POST",
				url: publicTokenEndpoint(),
				accessToken: "",
			});
			const tokenData = await refreshDirectoryToken(
				refreshToken,
				config.ATRIUM_WEB_CLIENT_ID,
				config.ATRIUM_WEB_CLIENT_SECRET,
				proof,
			);
			const session = await this.bindBrowserSession(
				c,
				tokenData,
				proofJkt,
				deviceLabel(body?.device_label, "Browser"),
			);
			return c.json(session, 200);
		} catch (error) {
			if (error instanceof AppError) throw error;
			this.logTokenFailure(error);
			clearWebAuthCookies(c);
			return c.json(
				{ error: "Session expired. Sign in again.", code: "AUTH_RELOGIN_REQUIRED" },
				401,
			);
		}
	};

	public static readonly logoutWebLogin = async (c: Context) => {
		const authorization = c.req.header("Authorization") ?? "";
		const headerToken = authorization.replace(/^(?:Bearer|DPoP)\s+/i, "").trim();
		const accessToken = headerToken || readAccessToken(c) || "";
		const refreshToken = readRefreshToken(c) ?? "";
		const idToken = readIdToken(c) ?? "";
		const proof = c.req.header("DPoP") ?? "";
		if (accessToken && proof) {
			try {
				const proofJkt = await verifyDpopProof({
					proof,
					method: c.req.method,
					url: c.req.url,
					urls: requestProofUrls(c.req.url),
					accessToken,
				});
				const payload = decodeJwt(accessToken);
				const bound = confirmationThumbprint(payload as Record<string, unknown>);
				if (bound && bound === proofJkt && typeof payload.sub === "string") {
					await SessionDeviceService.revokeThumbprint(payload.sub, bound);
				}
			} catch (error) {
				this.logTokenFailure(error);
			}
		}
		const authType = detectAuthType(accessToken);
		clearWebAuthCookies(c);

		if (authType === "SAML") {
			const dashboard = (config.DASHBOARD_URL || "http://localhost:8080").replace(/\/$/, "");
			return c.json(
				{
					message: "Web logout prepared successfully.",
					logoutUrl: `${dashboard}/login`,
				},
				200,
			);
		}

		await Promise.all([
			refreshToken
				? revokeDirectoryToken(refreshToken, "refresh_token").catch(() => undefined)
				: undefined,
			accessToken
				? revokeDirectoryToken(accessToken, "access_token").catch(() => undefined)
				: undefined,
		]);

		const logoutUrl = new URL(`${getIdentityIssuer()}/oauth/logout`);
		logoutUrl.searchParams.set("client_id", config.ATRIUM_WEB_CLIENT_ID);
		logoutUrl.searchParams.set("post_logout_redirect_uri", config.DASHBOARD_URL);
		logoutUrl.searchParams.set("confirm", "yes");
		if (idToken) {
			logoutUrl.searchParams.set("id_token_hint", idToken);
		}

		return c.json(
			{
				message: "Web logout prepared successfully.",
				logoutUrl: logoutUrl.toString(),
			},
			200,
		);
	};

	public static readonly createApiLogin = async (c: Context) => {
		const { ATRIUM_API_CLIENT_ID, ATRIUM_API_REDIRECT_URI } = config;

		const loginUrl = `${authorizeEndpoint()}?client_id=${ATRIUM_API_CLIENT_ID}&response_type=code&scope=openid%20email%20profile&redirect_uri=${encodeURIComponent(ATRIUM_API_REDIRECT_URI)}`;

		return c.json({ message: "API login created successfully.", loginUrl }, 201);
	};

	public static readonly callbackApiLogin = async (c: Context) => {
		const { ATRIUM_API_CLIENT_ID, ATRIUM_API_CLIENT_SECRET, ATRIUM_API_REDIRECT_URI } = config;

		const { code } = c.req.query();

		if (!code) {
			return c.json({ error: "Code is required." }, 400);
		}

		const tokenData = await exchangeAuthorizationCode(
			code,
			ATRIUM_API_REDIRECT_URI,
			ATRIUM_API_CLIENT_ID,
			ATRIUM_API_CLIENT_SECRET,
		);

		return c.json(
			{
				message: "API login callback successful.",
				tokenData,
			},
			200,
		);
	};
}

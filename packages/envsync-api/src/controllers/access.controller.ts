import { type Context } from "hono";
import * as openid from "openid-client";

import { config } from "@/utils/env";
import { getZitadelIssuer, zitadelTokenExchange } from "@/helpers/zitadel";

const zitadelDiscoveryUrl = () => `${getZitadelIssuer()}/.well-known/openid-configuration`;

export class AccessController {
	public static readonly createCliLogin = async (c: Context) => {
		try {
			const { ZITADEL_CLI_CLIENT_ID } = config;

			const authConfig: openid.Configuration = await openid.discovery(
				new URL(zitadelDiscoveryUrl()),
				ZITADEL_CLI_CLIENT_ID,
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
					client_id: ZITADEL_CLI_CLIENT_ID,
					domain: new URL(config.ZITADEL_URL).host,
				},
				201,
			);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly createWebLogin = async (c: Context) => {
		try {
			const { ZITADEL_WEB_CLIENT_ID, ZITADEL_WEB_REDIRECT_URI } = config;

			const loginUrl = `${zitadelDiscoveryUrl().replace("/.well-known/openid-configuration", "")}/oauth/v2/authorize?client_id=${ZITADEL_WEB_CLIENT_ID}&response_type=code&scope=openid%20email%20profile&redirect_uri=${encodeURIComponent(ZITADEL_WEB_REDIRECT_URI)}`;

			return c.json({ message: "Web login created successfully.", loginUrl }, 201);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly callbackWebLogin = async (c: Context) => {
		try {
			const {
				ZITADEL_WEB_CLIENT_ID,
				ZITADEL_WEB_CLIENT_SECRET,
				ZITADEL_WEB_REDIRECT_URI,
				ZITADEL_WEB_CALLBACK_URL,
			} = config;

			const { code } = c.req.query();

			if (!code) {
				return c.json({ error: "Code is required." }, 400);
			}

			const tokenData = await zitadelTokenExchange(
				code,
				ZITADEL_WEB_REDIRECT_URI,
				ZITADEL_WEB_CLIENT_ID,
				ZITADEL_WEB_CLIENT_SECRET,
			);

			const idToken = tokenData.id_token ?? tokenData.access_token;
			return c.redirect(ZITADEL_WEB_CALLBACK_URL + `?access_token=${idToken}`, 302);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly createApiLogin = async (c: Context) => {
		try {
			const { ZITADEL_API_CLIENT_ID, ZITADEL_API_REDIRECT_URI } = config;

			const loginUrl = `${zitadelDiscoveryUrl().replace("/.well-known/openid-configuration", "")}/oauth/v2/authorize?client_id=${ZITADEL_API_CLIENT_ID}&response_type=code&scope=openid%20email%20profile&redirect_uri=${encodeURIComponent(ZITADEL_API_REDIRECT_URI)}`;

			return c.json({ message: "API login created successfully.", loginUrl }, 201);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};

	public static readonly callbackApiLogin = async (c: Context) => {
		try {
			const {
				ZITADEL_API_CLIENT_ID,
				ZITADEL_API_CLIENT_SECRET,
				ZITADEL_API_REDIRECT_URI,
			} = config;

			const { code } = c.req.query();

			if (!code) {
				return c.json({ error: "Code is required." }, 400);
			}

			const tokenData = await zitadelTokenExchange(
				code,
				ZITADEL_API_REDIRECT_URI,
				ZITADEL_API_CLIENT_ID,
				ZITADEL_API_CLIENT_SECRET,
			);

			return c.json(
				{
					message: "API login callback successful.",
					tokenData,
				},
				200,
			);
		} catch (err) {
			if (err instanceof Error) {
				return c.json({ error: err.message }, 500);
			}
		}
	};
}

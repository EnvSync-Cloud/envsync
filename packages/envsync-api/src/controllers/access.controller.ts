import { type Context } from "hono";
import * as openid from "openid-client";

import { config } from "@/utils/env";
import { getKeycloakIssuer, keycloakTokenExchange } from "@/helpers/keycloak";

const keycloakDiscoveryUrl = () =>
	`${getKeycloakIssuer()}/.well-known/openid-configuration`;

const clientMetadata: openid.ClientMetadata = {
	client_id: config.KEYCLOAK_CLI_CLIENT_ID,
	redirect_uris: [],
};
const clientAuth: openid.ClientAuth = openid.None();

export class AccessController {
	public static readonly createCliLogin = async (c: Context) => {
		const { KEYCLOAK_CLI_CLIENT_ID } = config;

		const authConfig: openid.Configuration = await openid.discovery(
			new URL(keycloakDiscoveryUrl()),
			KEYCLOAK_CLI_CLIENT_ID,
			clientMetadata,
			clientAuth,
			{
				execute: [openid.allowInsecureRequests],
			},
		);

		const deviceAuthInit = await openid.initiateDeviceAuthorization(
			authConfig,
			{
				scope: "openid email profile",
			},
		);

		return c.json(
			{
				message: "CLI login created successfully.",
				verification_uri_complete:
					deviceAuthInit.verification_uri_complete,
				user_code: deviceAuthInit.user_code,
				device_code: deviceAuthInit.device_code,
				expires_in: deviceAuthInit.expires_in,
				interval: deviceAuthInit.interval,
				client_id: KEYCLOAK_CLI_CLIENT_ID,
				token_url: authConfig.serverMetadata().token_endpoint,
			},
			201,
		);
	};

	public static readonly createWebLogin = async (c: Context) => {
		const { KEYCLOAK_WEB_CLIENT_ID, KEYCLOAK_WEB_REDIRECT_URI } = config;

		const loginUrl = `${getKeycloakIssuer()}/protocol/openid-connect/auth?client_id=${KEYCLOAK_WEB_CLIENT_ID}&response_type=code&scope=openid%20email%20profile&redirect_uri=${encodeURIComponent(KEYCLOAK_WEB_REDIRECT_URI)}`;

		return c.json(
			{ message: "Web login created successfully.", loginUrl },
			201,
		);
	};

	public static readonly callbackWebLogin = async (c: Context) => {
		const {
			KEYCLOAK_WEB_CLIENT_ID,
			KEYCLOAK_WEB_CLIENT_SECRET,
			KEYCLOAK_WEB_REDIRECT_URI,
			KEYCLOAK_WEB_CALLBACK_URL,
		} = config;

		const { code } = c.req.query();

		if (!code) {
			return c.json({ error: "Code is required." }, 400);
		}

		const tokenData = await keycloakTokenExchange(
			code,
			KEYCLOAK_WEB_REDIRECT_URI,
			KEYCLOAK_WEB_CLIENT_ID,
			KEYCLOAK_WEB_CLIENT_SECRET,
		);

		const idToken = tokenData.id_token ?? tokenData.access_token;
		return c.redirect(
			KEYCLOAK_WEB_CALLBACK_URL + `#access_token=${idToken}`,
			302,
		);
	};

	public static readonly createApiLogin = async (c: Context) => {
		const { KEYCLOAK_API_CLIENT_ID, KEYCLOAK_API_REDIRECT_URI } = config;

		const loginUrl = `${getKeycloakIssuer()}/protocol/openid-connect/auth?client_id=${KEYCLOAK_API_CLIENT_ID}&response_type=code&scope=openid%20email%20profile&redirect_uri=${encodeURIComponent(KEYCLOAK_API_REDIRECT_URI)}`;

		return c.json(
			{ message: "API login created successfully.", loginUrl },
			201,
		);
	};

	public static readonly callbackApiLogin = async (c: Context) => {
		const {
			KEYCLOAK_API_CLIENT_ID,
			KEYCLOAK_API_CLIENT_SECRET,
			KEYCLOAK_API_REDIRECT_URI,
		} = config;

		const { code } = c.req.query();

		if (!code) {
			return c.json({ error: "Code is required." }, 400);
		}

		const tokenData = await keycloakTokenExchange(
			code,
			KEYCLOAK_API_REDIRECT_URI,
			KEYCLOAK_API_CLIENT_ID,
			KEYCLOAK_API_CLIENT_SECRET,
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

import { ApiKeyService } from "@/services/api_key.service";
import { OidcService } from "@/services/oidc.service";
import { ServiceTokenService } from "@/services/service_token.service";
import { UserService } from "@/services/user.service";
import { AppError } from "@/libs/errors";
import { verifyJWTToken } from "./jwt";
import { verifyOidcToken, mightBeOidcToken } from "./oidc";
import { getKeycloakIssuer } from "@/helpers/keycloak";
import { config } from "@/utils/env";

export type AuthTokenType = "JWT" | "API_KEY" | "OIDC" | "SAML" | "SERVICE_TOKEN";

const SAML_SESSION_TTL_SECONDS = 8 * 3600;

export function samlSessionSecret(): string {
	const explicit = config.SAML_SESSION_SECRET || process.env.SAML_SESSION_SECRET;
	if (explicit) return explicit;
	if (config.NODE_ENV === "production") {
		throw new AppError(
			"SAML_SESSION_SECRET is required in production.",
			500,
			"SAML_SESSION_SECRET_MISSING",
		);
	}
	return `saml-session:${config.KEYCLOAK_WEB_CLIENT_SECRET}:${config.KEYCLOAK_REALM}`;
}

export const validateAccess = async ({
	token,
	type,
}: {
	token: string;
	type: AuthTokenType;
}): Promise<{
	user_id: string;
	org_id?: string;
	auth_service_id?: string;
	auth_type: AuthTokenType;
	service_token?: Awaited<ReturnType<typeof ServiceTokenService.validateTokenByHash>>;
}> => {
	try {
		let userId: string = "";
		let orgId: string | undefined;
		let authServiceId: string | undefined;

		if (type === "JWT") {
			const decoded = await verifyJWTToken(token);
			const idpSub = decoded.sub as string;
			if (!idpSub) {
				throw new Error("JWT subject claim is missing");
			}
			authServiceId = idpSub;
			let user;
			try {
				user = await UserService.getUserByIdpId(idpSub);
			} catch (error) {
				throw new Error(
					`User not found for Keycloak subject ${idpSub}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
			userId = user.id;
		} else if (type === "SAML") {
			const decoded = await verifySamlToken(token);
			const sub = decoded.sub as string;
			if (!sub) {
				throw new Error("SAML token subject claim is missing");
			}
			const user = await UserService.getUser(sub);
			const tokenOrgId = typeof decoded.org_id === "string" ? decoded.org_id : "";
			if (!tokenOrgId || tokenOrgId !== user.org_id) {
				throw new Error("SAML token organization claim mismatch");
			}
			userId = user.id;
			orgId = user.org_id;
		} else if (type === "OIDC") {
			const enabledProviders = await OidcService.getAllEnabledProviders();
			if (enabledProviders.length === 0) {
				throw new Error("No OIDC providers configured");
			}

			const { provider } = await verifyOidcToken(token, enabledProviders);

			if (!provider.machine_user_id) {
				throw new Error("OIDC provider has no machine user assigned");
			}

			userId = provider.machine_user_id;
			authServiceId = `oidc:${provider.id}`;
		} else if (type === "SERVICE_TOKEN") {
			const serviceToken = await ServiceTokenService.validateTokenByHash(token);
			if (!serviceToken) {
				throw new Error("Invalid service token");
			}

			await ServiceTokenService.registerUsage(serviceToken.id);
			userId = serviceToken.created_by_user_id;
			orgId = serviceToken.org_id;

			return {
				user_id: userId,
				org_id: orgId,
				auth_service_id: authServiceId,
				auth_type: type,
				service_token: serviceToken,
			};
		} else if (type === "API_KEY") {
			const apiKey = await ApiKeyService.getKeyByCreds(token);

			if (!apiKey) {
				throw new Error("Invalid API key");
			}

			if (!apiKey.is_active) {
				throw new Error("API key is deactivated");
			}

			await ApiKeyService.registerKeyUsage(apiKey.id);

			userId = apiKey.user_id;
		}

		return {
			user_id: userId,
			org_id: orgId,
			auth_service_id: authServiceId,
			auth_type: type,
		};
	} catch (error) {
		if (error instanceof AppError) throw error;
		throw new Error(
			"Unauthorized access: " + (error instanceof Error ? error.message : "Unknown error"),
		);
	}
};

/**
 * Determine the auth type for a Bearer token.
 * - If the token's issuer is "envsync-saml" → SAML.
 * - If the token's issuer matches Keycloak → JWT.
 * - If the token's issuer matches a registered OIDC provider → OIDC.
 * - Falls back to JWT (which will fail with a clear error if invalid).
 */
export function detectAuthType(bearerToken: string): AuthTokenType {
	const cleanToken = bearerToken.replace(/^Bearer\s+/i, "");

	if (ServiceTokenService.isServiceTokenValue(cleanToken)) {
		return "SERVICE_TOKEN";
	}

	// Fast check: SAML tokens have a distinctive issuer
	if (isSamlToken(cleanToken)) {
		return "SAML";
	}

	const keycloakIssuer = getKeycloakIssuer();
	if (mightBeOidcToken(cleanToken, keycloakIssuer)) {
		return "OIDC";
	}

	return "JWT";
}

/**
 * Check if a JWT is a SAML session token by peeking at its payload's issuer.
 * This is a fast pre-check before signature verification.
 */
function isSamlToken(token: string): boolean {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return false;
		const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
		return payload.iss === "envsync-saml";
	} catch {
		return false;
	}
}

export async function issueSamlSessionToken(input: {
	userId: string;
	email: string;
	orgId: string;
}): Promise<string> {
	const secret = samlSessionSecret();
	const keyMaterial = new TextEncoder().encode(secret);
	const key = await crypto.subtle.importKey(
		"raw",
		keyMaterial as unknown as BufferSource,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const header = { alg: "HS256", typ: "JWT" };
	const now = Math.floor(Date.now() / 1000);
	const payload = {
		sub: input.userId,
		email: input.email,
		org_id: input.orgId,
		iss: "envsync-saml",
		auth_type: "saml",
		iat: now,
		exp: now + SAML_SESSION_TTL_SECONDS,
	};

	const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
	const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
	const signingInput = `${headerB64}.${payloadB64}`;
	const sig = new Uint8Array(
		await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput) as unknown as BufferSource),
	);
	const sigB64 = btoa(String.fromCharCode(...sig)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

	return `${signingInput}.${sigB64}`;
}

/**
 * Verify a SAML session token (HS256).
 * These tokens are issued by the SAML ACS endpoint and signed with a
 * derived secret from the SAML_SESSION_SECRET env var (or Keycloak config).
 */
async function verifySamlToken(token: string): Promise<Record<string, unknown>> {
	const secret = samlSessionSecret();
	const keyMaterial = new TextEncoder().encode(secret);
	const key = await crypto.subtle.importKey(
		"raw",
		keyMaterial as unknown as BufferSource,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"],
	);

	const parts = token.split(".");
	if (parts.length !== 3) throw new Error("Invalid SAML token format");

	const signingInput = `${parts[0]}.${parts[1]}`;
	const sigB64 = parts[2].replace(/-/g, "+").replace(/_/g, "/");
	const sigPadded = sigB64 + "=".repeat((4 - (sigB64.length % 4)) % 4);
	const sigBytes = Uint8Array.from(atob(sigPadded), (c) => c.charCodeAt(0));

	const valid = await crypto.subtle.verify(
		"HMAC",
		key,
		sigBytes as unknown as BufferSource,
		new TextEncoder().encode(signingInput) as unknown as BufferSource,
	);

	if (!valid) {
		throw new Error("SAML token signature verification failed");
	}

	const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
	const payloadPadded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
	const payload = JSON.parse(atob(payloadPadded));

	// Check expiration
	const now = Math.floor(Date.now() / 1000);
	if (payload.iss !== "envsync-saml") {
		throw new Error("SAML token issuer is invalid");
	}

	if (payload.exp && payload.exp < now) {
		throw new Error("SAML token has expired");
	}

	return payload as Record<string, unknown>;
}

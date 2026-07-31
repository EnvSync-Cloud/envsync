import { type Context } from "hono";

import { assertEntitled } from "@/helpers/enterprise-guard";
import { setWebAuthCookies, setActiveMembershipCookie } from "@/helpers/web-auth";
import { SamlService } from "@/services/saml.service";
import { UserService } from "@/services/user.service";
import { AuditLogService } from "@/services/audit_log.service";
import { config } from "@/utils/env";

// Derive SAML session signing key from environment
function getSamlSessionSecret(): string {
	const explicit = process.env.SAML_SESSION_SECRET;
	if (explicit) return explicit;
	// Derive from existing Keycloak config so SAML sessions survive restarts
	return `saml-session:${config.KEYCLOAK_WEB_CLIENT_SECRET}:${config.KEYCLOAK_REALM}`;
}

/**
 * Generate a SAML-specific session JWT (HS256).
 * This token is used for SAML SSO sessions alongside the Keycloak JWT flow.
 * The auth middleware validates these via a separate code path in access.ts.
 */
async function generateSamlSessionToken(userId: string, email: string): Promise<string> {
	const secret = getSamlSessionSecret();
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
		sub: userId,
		email,
		iss: "envsync-saml",
		iat: now,
		exp: now + 60 * 60, // 1 hour
		auth_type: "saml",
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

export class SamlController {
	public static readonly createProvider = async (c: Context) => {
		await assertEntitled("saml");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const body = await c.req.json();

		const provider = await SamlService.createProvider({
			org_id,
			provider_type: body.provider_type,
			name: body.name,
			entity_id: body.entity_id,
			sso_url: body.sso_url,
			certificate: body.certificate,
		});

		await AuditLogService.notifyAuditSystem({
			action: "saml_provider_created",
			org_id,
			user_id,
			message: `SAML provider created: ${body.provider_type} (${body.name})`,
			details: {
				provider_id: provider.id,
				provider_type: body.provider_type,
				entity_id: body.entity_id,
			},
		});

		return c.json(provider, 201);
	};

	public static readonly getProvider = async (c: Context) => {
		await assertEntitled("saml");
		const id = c.req.param("id");
		const org_id = c.get("org_id");

		const provider = await SamlService.getProvider(id);

		if (provider.org_id !== org_id) {
			return c.json({ error: "SAML provider not found" }, 404);
		}

		return c.json(provider, 200);
	};

	public static readonly getAllProviders = async (c: Context) => {
		await assertEntitled("saml");
		const org_id = c.get("org_id");
		const providers = await SamlService.getProvidersByOrg(org_id);
		return c.json(providers, 200);
	};

	public static readonly updateProvider = async (c: Context) => {
		await assertEntitled("saml");

		const id = c.req.param("id");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");
		const body = await c.req.json();

		const existing = await SamlService.getProvider(id);

		if (existing.org_id !== org_id) {
			return c.json({ error: "SAML provider not found" }, 404);
		}

		await SamlService.updateProvider(id, {
			name: body.name,
			entity_id: body.entity_id,
			sso_url: body.sso_url,
			certificate: body.certificate,
			enabled: body.enabled,
		});

		await AuditLogService.notifyAuditSystem({
			action: "saml_provider_updated",
			org_id,
			user_id,
			message: `SAML provider updated: ${id}`,
			details: { provider_id: id },
		});

		return c.json({ message: "SAML provider updated successfully." }, 200);
	};

	public static readonly deleteProvider = async (c: Context) => {
		await assertEntitled("saml");
		const id = c.req.param("id");
		const org_id = c.get("org_id");
		const user_id = c.get("user_id");

		const existing = await SamlService.getProvider(id);

		if (existing.org_id !== org_id) {
			return c.json({ error: "SAML provider not found" }, 404);
		}

		await SamlService.deleteProvider(id);

		await AuditLogService.notifyAuditSystem({
			action: "saml_provider_deleted",
			org_id,
			user_id,
			message: `SAML provider deleted: ${id}`,
			details: { provider_id: id, entity_id: existing.entity_id },
		});

		return c.json({ message: "SAML provider deleted successfully." }, 200);
	};

	public static readonly getMetadata = async (c: Context) => {
		await assertEntitled("saml");
		const org_id = c.get("org_id");
		const metadata = await SamlService.getMetadata(org_id);
		return c.text(metadata, 200, { "Content-Type": "application/xml" });
	};

	public static readonly initiateSso = async (c: Context) => {
		await assertEntitled("saml");
		const org_id = c.get("org_id");
		const body = await c.req.json();
		const provider = await SamlService.getProvider(body.provider_id);

		if (provider.org_id !== org_id) {
			return c.json({ error: "SAML provider not found" }, 404);
		}

		const acsUrl = `${c.req.url.split("/saml")[0]}/saml/acs/${org_id}`;
		const { redirectUrl, requestId } = await SamlService.initiateSso(body.provider_id, acsUrl);

		return c.json({ redirect_url: redirectUrl, request_id: requestId }, 200);
	};

	/**
	 * ACS (Assertion Consumer Service) endpoint.
	 *
	 * This is an unauthenticated endpoint that receives the SAML Response from the IdP.
	 * After validating the response and creating/updating the user, it:
	 * 1. Generates a SAML session token
	 * 2. Sets auth cookies (same pattern as Keycloak flow)
	 * 3. Redirects to the dashboard callback URL
	 */
	public static readonly handleAcs = async (c: Context) => {
		// NOTE: No assertEnterprise() here — this is an unauthenticated endpoint.
		// The IdP POSTs directly to this URL without any auth context.
		const org_id = c.req.param("orgId");
		const body = await c.req.parseBody();
		const samlResponse = body.SAMLResponse;

		if (typeof samlResponse !== "string") {
			return c.json({ error: "Missing SAMLResponse" }, 400);
		}

		const providers = await SamlService.getProvidersByOrg(org_id);
		const enabledProviders = providers.filter((p) => p.enabled);

		if (enabledProviders.length === 0) {
			return c.json({ error: "No SAML providers configured for this organization" }, 400);
		}

		let lastError: Error | null = null;
		for (const provider of enabledProviders) {
			try {
				const acsUrl = `${c.req.url.split("?")[0]}`;
				const result = await SamlService.handleAcs(provider.id, samlResponse, acsUrl);

				// Generate SAML session token
				const accessToken = await generateSamlSessionToken(result.userId, result.email);

				// Set auth cookies (same pattern as Keycloak flow)
				setWebAuthCookies(c, {
					access_token: accessToken,
					expires_in: 3600,
				});

				// Set active membership cookie for multi-org support
				await UserService.touchLastLogin(result.userId);
				setActiveMembershipCookie(c, result.userId);

				await AuditLogService.notifyAuditSystem({
					action: "saml_sso_success",
					org_id,
					user_id: result.userId,
					message: `SAML SSO login via ${provider.provider_type}: ${result.email}`,
					details: {
						provider_id: provider.id,
						provider_type: provider.provider_type,
						email: result.email,
					},
				});

				// Redirect to dashboard callback (same as Keycloak flow)
				const callbackUrl = config.DASHBOARD_URL || "http://localhost:8080";
				return c.redirect(`${callbackUrl}/auth/callback`, 302);
			} catch (err) {
				lastError = err instanceof Error ? err : new Error(String(err));
				continue;
			}
		}

		return c.json({
			error: "SAML authentication failed",
			details: lastError?.message ?? "No matching provider could validate the response",
		}, 401);
	};
}

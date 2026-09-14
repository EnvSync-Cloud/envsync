import { type Context } from "hono";

import { AppError, ForbiddenError, NotFoundError } from "envsync-api/ports/errors";
import { issueSamlSessionToken, setActiveMembershipCookie, setWebAuthCookies } from "envsync-api/ports/helpers";
import { SamlService } from "../services/saml.service";
import { AuditLogService } from "envsync-api/ports/services";
import { config } from "envsync-api/ports/env";

const SSO_NOT_AVAILABLE_BODY = {
	error: "SSO is not available for this organization.",
	code: "SSO_NOT_AVAILABLE",
} as const;

const SAML_SESSION_TTL_SECONDS = 8 * 3600;

function dashboardUrl() {
	const url = config.DASHBOARD_URL?.replace(/\/$/, "");
	if (!url) {
		throw new AppError("DASHBOARD_URL is required.", 500, "DASHBOARD_URL_MISSING");
	}
	if (config.NODE_ENV === "production" && /localhost|127\.0\.0\.1/i.test(url)) {
		throw new AppError("DASHBOARD_URL must be a public origin in production.", 500, "DASHBOARD_URL_INVALID");
	}
	return url;
}

function isPublicSsoDeny(err: unknown): boolean {
	if (err instanceof ForbiddenError || err instanceof NotFoundError) return true;
	if (err instanceof AppError && (err.code === "SSO_NOT_AVAILABLE" || err.statusCode === 403 || err.statusCode === 404)) {
		return true;
	}
	return false;
}

function publicSsoNotAvailable(c: Context) {
	return c.json(SSO_NOT_AVAILABLE_BODY, 404);
}

export class SamlController {
	public static readonly createProvider = async (c: Context) => {
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
			idp_metadata_xml: body.idp_metadata_xml,
			is_default: body.is_default,
		});

		await AuditLogService.notifyAuditSystem({
			action: "saml_provider_created",
			org_id,
			user_id,
			message: `SAML provider created: ${body.provider_type} (${body.name})`,
			details: {
				provider_id: provider.id,
				provider_type: body.provider_type,
				entity_id: provider.entity_id,
			},
		});

		return c.json(SamlService.redactProvider(provider), 201);
	};

	public static readonly getProvider = async (c: Context) => {
		const id = c.req.param("id");
		const org_id = c.get("org_id");
		const includeCertificate = c.req.query("include") === "certificate";

		const provider = await SamlService.getProvider(id);

		if (provider.org_id !== org_id) {
			return c.json({ error: "SAML provider not found" }, 404);
		}

		return c.json(SamlService.redactProvider(provider, includeCertificate), 200);
	};

	public static readonly getAllProviders = async (c: Context) => {
		const org_id = c.get("org_id");
		const providers = await SamlService.getProvidersByOrg(org_id);
		return c.json(providers.map(provider => SamlService.redactProvider(provider)), 200);
	};

	public static readonly updateProvider = async (c: Context) => {
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
			is_default: body.is_default,
			idp_metadata_xml: body.idp_metadata_xml,
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
		const org_id = c.get("org_id");
		return c.redirect(`${SamlService.apiBaseUrl()}/api/saml/metadata/${org_id}`, 302);
	};

	public static readonly getPublicMetadata = async (c: Context) => {
		const orgId = c.req.param("orgId");
		try {
			await SamlService.assertPublicOrgSaml(orgId);
			const metadata = await SamlService.getMetadata(orgId);
			return c.text(metadata, 200, { "Content-Type": "application/xml" });
		} catch (err) {
			if (isPublicSsoDeny(err)) return publicSsoNotAvailable(c);
			throw err;
		}
	};

	public static readonly startPublicSso = async (c: Context) => {
		const orgSlug = c.req.param("orgSlug");
		const body = (await c.req.json().catch(() => ({}))) as { provider_id?: string };
		try {
			const result = await SamlService.startByOrgSlug(orgSlug, body.provider_id);
			await AuditLogService.notifyAuditSystem({
				action: "saml_sso_start",
				org_id: result.orgId,
				user_id: result.orgId,
				message: `SAML SSO start via ${result.provider.provider_type}`,
				details: {
					provider_id: result.provider.id,
					request_id: result.requestId,
				},
			}).catch(() => undefined);
			return c.json({ redirect_url: result.redirectUrl, request_id: result.requestId }, 200);
		} catch (err) {
			if (isPublicSsoDeny(err)) return publicSsoNotAvailable(c);
			throw err;
		}
	};

	public static readonly startPublicSsoRedirect = async (c: Context) => {
		const orgSlug = c.req.param("orgSlug");
		try {
			const result = await SamlService.startByOrgSlug(orgSlug);
			return c.redirect(result.redirectUrl, 302);
		} catch {
			return c.redirect(`${dashboardUrl()}/login?sso=failed`, 302);
		}
	};

	public static readonly handlePublicAcs = async (c: Context) => {
		const orgId = c.req.param("orgId");
		const body = await c.req.parseBody();
		const samlResponse = body.SAMLResponse;
		const relayState = body.RelayState;

		if (typeof samlResponse !== "string" || typeof relayState !== "string" || !relayState) {
			return c.json({ error: "SAML authentication failed", code: "SAML_ACS_FAILED" }, 401);
		}

		try {
			const result = await SamlService.handleBoundAcs(orgId, samlResponse, relayState);
			const accessToken = await issueSamlSessionToken({
				userId: result.userId,
				email: result.email,
				orgId: result.orgId,
			});

			setWebAuthCookies(c, {
				access_token: accessToken,
				expires_in: SAML_SESSION_TTL_SECONDS,
			});
			setActiveMembershipCookie(c, result.userId, SAML_SESSION_TTL_SECONDS);

			await AuditLogService.notifyAuditSystem({
				action: "saml_sso_success",
				org_id: result.orgId,
				user_id: result.userId,
				message: `SAML SSO login via ${result.providerType}: ${result.email}`,
				details: {
					provider_id: result.providerId,
					provider_type: result.providerType,
					email: result.email,
				},
			});

			return c.redirect(`${dashboardUrl()}/auth/callback`, 302);
		} catch {
			await AuditLogService.notifyAuditSystem({
				action: "saml_sso_failure",
				org_id: orgId,
				user_id: orgId,
				message: "SAML ACS failed",
				details: { reason: "acs_failed" },
			}).catch(() => undefined);
			return c.json({ error: "SAML authentication failed", code: "SAML_ACS_FAILED" }, 401);
		}
	};
}

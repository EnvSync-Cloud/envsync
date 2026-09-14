import { NoResultError, type Selectable } from "kysely";
import { v4 as uuidv4 } from "uuid";

import { cacheAside, cacheGetDel, cacheSetJson, invalidateCache } from "envsync-api/ports/helpers";
import { CacheKeys, CacheTTL } from "envsync-api/ports/helpers";
import {
	buildAuthnRequest,
	buildSpMetadata,
	deflateAndEncode,
	parseIdpMetadataXml,
	redactSamlCertificate,
	signRelayState,
	validateSamlResponse,
	verifyRelayState,
} from "envsync-api/ports/helpers";
import { samlSessionSecret } from "envsync-api/ports/helpers";
import { DB } from "envsync-api/ports/db";
import { AppError, ForbiddenError, NotFoundError, orNotFound } from "envsync-api/ports/errors";
import { config } from "envsync-api/ports/env";
import infoLogs, { LogTypes } from "envsync-api/ports/logger";
import { createKeycloakUser, findKeycloakUserByUsername } from "envsync-api/ports/helpers";
import { EntitlementService, OrgService, UserService } from "envsync-api/ports/services";
import type { Database } from "envsync-api/ports/types-db";

type SamlProviderRow = Selectable<Database["saml_providers"]>;

export type SamlProviderType =
	| "okta"
	| "onelogin"
	| "azure-ad"
	| "google-workspace"
	| "duo"
	| "rippling"
	| "oracle"
	| "ping-identity";

export interface SamlSessionResult {
	userId: string;
	email: string;
	orgId: string;
	providerId: string;
	providerType: string;
}

export type PendingSamlAuthn = {
	request_id: string;
	org_id: string;
	provider_id: string;
	acs_url: string;
	created_at: number;
};

const SSO_NOT_AVAILABLE = () =>
	new AppError("SSO is not available for this organization.", 404, "SSO_NOT_AVAILABLE");

export class SamlService {
	public static createProvider = async (data: {
		org_id: string;
		provider_type: SamlProviderType;
		name: string;
		entity_id?: string;
		sso_url?: string;
		certificate?: string;
		idp_metadata_xml?: string;
		is_default?: boolean;
	}): Promise<SamlProviderRow> => {
		const parsed = data.idp_metadata_xml ? parseIdpMetadataXml(data.idp_metadata_xml) : null;
		const entityId = data.entity_id || parsed?.entity_id;
		const ssoUrl = data.sso_url || parsed?.sso_url;
		const certificate = data.certificate || parsed?.certificate;
		if (!entityId || !ssoUrl || !certificate) {
			throw new AppError(
				"Provide idp_metadata_xml or entity_id, sso_url, and certificate",
				400,
				"VALIDATION_ERROR",
			);
		}

		const db = await DB.getInstance();
		if (data.is_default) {
			await SamlService.clearDefaultForOrg(data.org_id);
		}

		const provider = await db
			.insertInto("saml_providers")
			.values({
				id: uuidv4(),
				org_id: data.org_id,
				provider_type: data.provider_type,
				name: data.name,
				entity_id: entityId,
				sso_url: ssoUrl,
				certificate,
				enabled: true,
				is_default: data.is_default ?? false,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		await invalidateCache(CacheKeys.samlProvidersByOrg(data.org_id));

		return provider;
	};

	public static getProvider = async (id: string): Promise<SamlProviderRow> => {
		const db = await DB.getInstance();
		return orNotFound(
			db
				.selectFrom("saml_providers")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"SAML Provider",
			id,
		);
	};

	public static getProvidersByOrg = async (orgId: string): Promise<SamlProviderRow[]> => {
		return cacheAside(CacheKeys.samlProvidersByOrg(orgId), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();
			return db
				.selectFrom("saml_providers")
				.selectAll()
				.where("org_id", "=", orgId)
				.execute();
		});
	};

	public static updateProvider = async (
		id: string,
		data: {
			name?: string;
			entity_id?: string;
			sso_url?: string;
			certificate?: string;
			enabled?: boolean;
			is_default?: boolean;
			idp_metadata_xml?: string;
		},
	): Promise<void> => {
		const db = await DB.getInstance();

		const existing = await orNotFound(
			db
				.selectFrom("saml_providers")
				.select(["org_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"SAML Provider",
			id,
		);

		const parsed = data.idp_metadata_xml ? parseIdpMetadataXml(data.idp_metadata_xml) : null;
		const patch: Record<string, unknown> = {
			updated_at: new Date(),
		};
		if (data.name !== undefined) patch.name = data.name;
		if (data.enabled !== undefined) patch.enabled = data.enabled;
		if (data.entity_id !== undefined || parsed?.entity_id) patch.entity_id = data.entity_id || parsed?.entity_id;
		if (data.sso_url !== undefined || parsed?.sso_url) patch.sso_url = data.sso_url || parsed?.sso_url;
		if (data.certificate !== undefined || parsed?.certificate) {
			patch.certificate = data.certificate || parsed?.certificate;
		}
		if (data.is_default !== undefined) {
			if (data.is_default) {
				await SamlService.clearDefaultForOrg(existing.org_id);
			}
			patch.is_default = data.is_default;
		}

		await db
			.updateTable("saml_providers")
			.set(patch)
			.where("id", "=", id)
			.execute();

		await invalidateCache(CacheKeys.samlProvidersByOrg(existing.org_id));
	};

	public static deleteProvider = async (id: string): Promise<void> => {
		const db = await DB.getInstance();

		const existing = await orNotFound(
			db
				.selectFrom("saml_providers")
				.select(["org_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"SAML Provider",
			id,
		);

		await db.deleteFrom("saml_providers").where("id", "=", id).executeTakeFirstOrThrow();

		await invalidateCache(CacheKeys.samlProvidersByOrg(existing.org_id));
	};

	public static startByOrgSlug = async (
		slug: string,
		providerId?: string,
	): Promise<{ redirectUrl: string; requestId: string; orgId: string; provider: SamlProviderRow }> => {
		const org = await OrgService.getOrgBySlug(slug);
		if (!org) {
			throw SSO_NOT_AVAILABLE();
		}

		try {
			await EntitlementService.assertFeature("saml");
			await EntitlementService.assertOrgFeature(org.id, "saml");
		} catch (err) {
			if (err instanceof ForbiddenError || (err instanceof AppError && err.statusCode === 403)) {
				throw SSO_NOT_AVAILABLE();
			}
			throw err;
		}

		const provider = await SamlService.pickEnabledProvider(org.id, providerId);
		const acsUrl = SamlService.buildAcsUrl(org.id);
		const spEntityId = SamlService.buildSpEntityId(org.id);
		const { xml, requestId } = buildAuthnRequest(spEntityId, acsUrl, provider.sso_url);

		const pending: PendingSamlAuthn = {
			request_id: requestId,
			org_id: org.id,
			provider_id: provider.id,
			acs_url: acsUrl,
			created_at: Date.now(),
		};
		await cacheSetJson(CacheKeys.samlAuthn(requestId), pending, CacheTTL.SAML_AUTHN);

		const relayState = signRelayState(
			{ v: 1, rid: requestId, org: org.id, pid: provider.id },
			samlSessionSecret(),
		);
		const encodedRequest = deflateAndEncode(xml);
		const redirectUrl = SamlService.buildIdpRedirectUrl(provider.sso_url, encodedRequest, relayState);

		return { redirectUrl, requestId, orgId: org.id, provider };
	};

	public static handleBoundAcs = async (
		orgId: string,
		samlResponseBase64: string,
		relayState: string,
	): Promise<SamlSessionResult> => {
		const bound = verifyRelayState(relayState, samlSessionSecret());
		if (bound.org !== orgId) {
			throw new Error("RelayState organization mismatch");
		}

		const pending = await cacheGetDel<PendingSamlAuthn>(CacheKeys.samlAuthn(bound.rid));
		if (!pending || pending.org_id !== orgId || pending.org_id !== bound.org) {
			throw new Error("Unknown or expired SAML request");
		}
		if (pending.provider_id !== bound.pid) {
			throw new Error("RelayState provider mismatch");
		}

		const provider = await SamlService.getProvider(pending.provider_id);
		if (!provider.enabled || provider.org_id !== orgId) {
			throw new Error("SAML provider is not available");
		}

		const acsUrl = SamlService.buildAcsUrl(orgId);
		const spEntityId = SamlService.buildSpEntityId(orgId);
		const result = await validateSamlResponse(
			samlResponseBase64,
			provider.certificate,
			acsUrl,
			spEntityId,
		);

		if (result.inResponseTo !== pending.request_id) {
			throw new Error("SAML InResponseTo mismatch");
		}

		const { email, firstName, lastName } = result.attributes;
		const fullName = [firstName, lastName].filter(Boolean).join(" ") || email;
		const userId = await SamlService.resolveSamlUser({
			email,
			fullName,
			orgId,
		});

		const db = await DB.getInstance();
		await db
			.updateTable("saml_providers")
			.set({ last_sso_at: new Date(), updated_at: new Date() })
			.where("id", "=", provider.id)
			.execute();
		await invalidateCache(CacheKeys.samlProvidersByOrg(orgId));

		return {
			userId,
			email,
			orgId,
			providerId: provider.id,
			providerType: provider.provider_type,
		};
	};

	public static getMetadata = async (orgId: string): Promise<string> => {
		const spEntityId = SamlService.buildSpEntityId(orgId);
		const acsUrl = SamlService.buildAcsUrl(orgId);
		SamlService.warnIfLocalhostSpUrl(spEntityId);
		return buildSpMetadata(spEntityId, acsUrl);
	};

	public static assertPublicOrgSaml = async (orgId: string): Promise<void> => {
		try {
			const org = await OrgService.getOrg(orgId);
			if (!org) throw SSO_NOT_AVAILABLE();
			await EntitlementService.assertFeature("saml");
			await EntitlementService.assertOrgFeature(org.id, "saml");
		} catch (err) {
			if (
				err instanceof ForbiddenError
				|| err instanceof NotFoundError
				|| err instanceof NoResultError
				|| (err instanceof AppError && (err.statusCode === 403 || err.statusCode === 404))
			) {
				throw SSO_NOT_AVAILABLE();
			}
			throw err;
		}
	};

	public static redactProvider = (
		provider: SamlProviderRow,
		includeCertificate = false,
	) => {
		const redacted = redactSamlCertificate(provider.certificate);
		return {
			...provider,
			certificate: includeCertificate ? provider.certificate : undefined,
			certificate_fingerprint: redacted.fingerprint,
			certificate_not_after: redacted.notAfter,
		};
	};

	public static apiBaseUrl = (): string => {
		const raw = config.API_URL?.trim();
		if (!raw) {
			throw new AppError("API_URL is required for SAML SP URLs.", 500, "SAML_API_URL_MISSING");
		}
		const origin = raw.replace(/\/$/, "");
		let host = "";
		try {
			host = new URL(origin).hostname;
		} catch {
			throw new AppError("API_URL must be an absolute URL for SAML SP URLs.", 500, "SAML_API_URL_INVALID");
		}
		if (config.NODE_ENV === "production" && (host === "localhost" || host === "127.0.0.1")) {
			throw new AppError(
				"API_URL must be a public origin in production so IdPs can POST to ACS.",
				500,
				"SAML_API_URL_LOOPBACK",
			);
		}
		return origin;
	};

	private static warnIfLocalhostSpUrl = (spEntityId: string): void => {
		try {
			const host = new URL(spEntityId).hostname;
			if (host === "localhost" || host === "127.0.0.1") {
				infoLogs(
					`SAML SP entity ID is ${spEntityId}. Set API_URL to a public origin or IdPs cannot POST back to ACS.`,
					LogTypes.ERROR,
					"SAML",
				);
			}
		} catch {
			// ignore unparseable entity IDs
		}
	};

	public static buildSpEntityId = (orgId: string): string => {
		return `${SamlService.apiBaseUrl()}/api/saml/metadata/${orgId}`;
	};

	public static buildAcsUrl = (orgId: string): string => {
		return `${SamlService.apiBaseUrl()}/api/saml/acs/${orgId}`;
	};

	private static pickEnabledProvider = async (
		orgId: string,
		providerId?: string,
	): Promise<SamlProviderRow> => {
		if (providerId) {
			try {
				const provider = await SamlService.getProvider(providerId);
				if (provider.org_id !== orgId || !provider.enabled) {
					throw SSO_NOT_AVAILABLE();
				}
				return provider;
			} catch (err) {
				if (err instanceof AppError && err.code === "SSO_NOT_AVAILABLE") throw err;
				throw SSO_NOT_AVAILABLE();
			}
		}

		const enabled = (await SamlService.getProvidersByOrg(orgId)).filter(provider => provider.enabled);
		const defaults = enabled.filter(provider => provider.is_default);
		if (defaults.length === 1) return defaults[0];
		if (enabled.length === 1) return enabled[0];
		throw SSO_NOT_AVAILABLE();
	};

	private static clearDefaultForOrg = async (orgId: string): Promise<void> => {
		const db = await DB.getInstance();
		await db
			.updateTable("saml_providers")
			.set({ is_default: false, updated_at: new Date() })
			.where("org_id", "=", orgId)
			.where("is_default", "=", true)
			.execute();
	};

	private static buildIdpRedirectUrl = (
		ssoUrl: string,
		encodedRequest: string,
		relayState: string,
	): string => {
		const url = new URL(ssoUrl);
		url.searchParams.set("SAMLRequest", encodedRequest);
		url.searchParams.set("RelayState", relayState);
		return url.toString();
	};

	/**
	 * Find an existing user in the org by email, or create a new one with
	 * Keycloak identity and a default Developer role.
	 */
	private static resolveSamlUser = async (input: {
		email: string;
		fullName: string;
		orgId: string;
	}): Promise<string> => {
		const existing = await UserService.getOrgUserByEmail(input.orgId, input.email);
		if (existing) {
			await UserService.touchLastLogin(existing.id);
			return existing.id;
		}

		const keycloakId = await SamlService.ensureKeycloakIdentity(input.email, input.fullName);
		const roleId = await SamlService.getDefaultMemberRoleId(input.orgId);
		const membership = await UserService.createMembershipForExistingIdentity({
			email: input.email,
			full_name: input.fullName,
			auth_service_id: keycloakId,
			org_id: input.orgId,
			role_id: roleId,
			is_active: true,
		});

		return membership.id;
	};

	/**
	 * Ensure a Keycloak user exists for the given email. Returns the Keycloak user ID.
	 * JIT users are created without a usable password. Pre-existing Keycloak users
	 * keep their credentials.
	 */
	private static ensureKeycloakIdentity = async (
		email: string,
		fullName: string,
	): Promise<string> => {
		const existing = await findKeycloakUserByUsername(email);
		if (existing?.id) return existing.id;

		const parts = fullName.trim().split(/\s+/);
		const firstName = parts[0]?.slice(0, 200) ?? "User";
		const lastName = parts.slice(1).join(" ").slice(0, 200) || "-";

		const created = await createKeycloakUser({
			userName: email,
			email,
			firstName,
			lastName,
			passwordEnabled: false,
		});

		return created.id;
	};

	private static getDefaultMemberRoleId = async (orgId: string): Promise<string> => {
		const db = await DB.getInstance();

		const developerRole = await db
			.selectFrom("org_role")
			.select("id")
			.where("org_id", "=", orgId)
			.where("name", "=", "Developer")
			.executeTakeFirst();

		if (developerRole) return developerRole.id;

		const fallbackRole = await db
			.selectFrom("org_role")
			.select("id")
			.where("org_id", "=", orgId)
			.where("is_admin", "=", false)
			.executeTakeFirst();

		if (fallbackRole) return fallbackRole.id;

		const anyRole = await orNotFound(
			db
				.selectFrom("org_role")
				.select("id")
				.where("org_id", "=", orgId)
				.executeTakeFirstOrThrow(),
			"Role for organization",
			orgId,
		);

		return anyRole.id;
	};
}

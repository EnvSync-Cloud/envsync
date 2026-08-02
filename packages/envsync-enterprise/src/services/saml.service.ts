import { type Selectable } from "kysely";
import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "envsync-api/ports/helpers";
import { CacheKeys, CacheTTL } from "envsync-api/ports/helpers";
import {
	buildAuthnRequest,
	buildSpMetadata,
	validateSamlResponse,
	type SamlAssertionAttributes,
} from "envsync-api/ports/helpers";
import { DB } from "envsync-api/ports/db";
import { orNotFound } from "envsync-api/ports/errors";
import { config } from "envsync-api/ports/env";
import { createKeycloakUser, findKeycloakUserByUsername } from "envsync-api/ports/helpers";
import { UserService } from "envsync-api/ports/services";
import { RoleService } from "envsync-api/ports/services";
import { AuthorizationService } from "envsync-api/ports/services";
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
}

export class SamlService {
	public static createProvider = async (data: {
		org_id: string;
		provider_type: SamlProviderType;
		name: string;
		entity_id: string;
		sso_url: string;
		certificate: string;
	}): Promise<SamlProviderRow> => {
		const db = await DB.getInstance();

		const provider = await db
			.insertInto("saml_providers")
			.values({
				id: uuidv4(),
				org_id: data.org_id,
				provider_type: data.provider_type,
				name: data.name,
				entity_id: data.entity_id,
				sso_url: data.sso_url,
				certificate: data.certificate,
				enabled: true,
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

		await db
			.updateTable("saml_providers")
			.set({ ...data, updated_at: new Date() })
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

	public static initiateSso = async (
		providerId: string,
		acsUrl: string,
	): Promise<{ redirectUrl: string; requestId: string }> => {
		const provider = await SamlService.getProvider(providerId);

		if (!provider.enabled) {
			throw new Error("SAML provider is disabled");
		}

		const spEntityId = SamlService.buildSpEntityId(provider.org_id);
		const { xml, requestId } = buildAuthnRequest(spEntityId, acsUrl, provider.sso_url);

		const encodedRequest = btoa(xml);
		const redirectUrl = `${provider.sso_url}?SAMLRequest=${encodeURIComponent(encodedRequest)}`;

		return { redirectUrl, requestId };
	};

	public static handleAcs = async (
		providerId: string,
		samlResponseBase64: string,
		acsUrl: string,
	): Promise<SamlSessionResult> => {
		const provider = await SamlService.getProvider(providerId);

		if (!provider.enabled) {
			throw new Error("SAML provider is disabled");
		}

		const result = await validateSamlResponse(
			samlResponseBase64,
			provider.certificate,
			acsUrl,
		);

		const { email, firstName, lastName } = result.attributes;
		const fullName = [firstName, lastName].filter(Boolean).join(" ") || email;
		const orgId = provider.org_id;

		// Resolve or create user in the organization
		const userId = await SamlService.resolveSamlUser({
			email,
			fullName,
			orgId,
		});

		return { userId, email, orgId };
	};

	public static getMetadata = async (orgId: string): Promise<string> => {
		const spEntityId = SamlService.buildSpEntityId(orgId);
		const acsUrl = SamlService.buildAcsUrl(orgId);
		return buildSpMetadata(spEntityId, acsUrl);
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
		// Check if user already exists in this org
		const existing = await UserService.getOrgUserByEmail(input.orgId, input.email);
		if (existing) {
			await UserService.touchLastLogin(existing.id);
			return existing.id;
		}

		// Ensure Keycloak identity exists (idempotent)
		const keycloakId = await SamlService.ensureKeycloakIdentity(input.email, input.fullName);

		// Find the default Developer role for this org
		const roleId = await SamlService.getDefaultMemberRoleId(input.orgId);

		// Create the membership record
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
	 * If the user already exists in Keycloak, returns the existing ID.
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

		// Generate a random password (SAML users authenticate via IdP, not password)
		const randomPassword = crypto.randomUUID() + crypto.randomUUID();

		const created = await createKeycloakUser({
			userName: email,
			email,
			firstName,
			lastName,
			password: randomPassword,
		});

		return created.id;
	};

	/**
	 * Get the default "Developer" role ID for an organization.
	 * Falls back to the first available role if Developer doesn't exist.
	 */
	private static getDefaultMemberRoleId = async (orgId: string): Promise<string> => {
		const db = await DB.getInstance();

		const developerRole = await db
			.selectFrom("org_role")
			.select("id")
			.where("org_id", "=", orgId)
			.where("name", "=", "Developer")
			.executeTakeFirst();

		if (developerRole) return developerRole.id;

		// Fallback: first non-admin role
		const fallbackRole = await db
			.selectFrom("org_role")
			.select("id")
			.where("org_id", "=", orgId)
			.where("is_admin", "=", false)
			.executeTakeFirst();

		if (fallbackRole) return fallbackRole.id;

		// Last resort: first role in the org
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

	private static buildSpEntityId = (orgId: string): string => {
		const baseUrl = config.DASHBOARD_URL || "http://localhost:8001";
		return `${baseUrl}/api/saml/metadata/${orgId}`;
	};

	private static buildAcsUrl = (orgId: string): string => {
		const baseUrl = config.API_URL || "http://localhost:4000";
		return `${baseUrl}/api/saml/acs/${orgId}`;
	};
}

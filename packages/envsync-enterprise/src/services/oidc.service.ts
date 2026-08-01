import { type Selectable } from "kysely";
import { v4 as uuidv4 } from "uuid";

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { clearJwksCache } from "@/helpers/oidc";
import { DB } from "@/libs/db";
import { orNotFound } from "@/libs/errors";
import { RoleService } from "@/services/role.service";
import { AuthorizationService } from "@/services/authorization.service";
import type { Database } from "@/types/db";

type OidcProviderRow = Selectable<Database["oidc_providers"]>;

export class OidcService {
	/**
	 * Create an OIDC provider and a corresponding machine user.
	 * The machine user is a DB-only identity (no Keycloak account) that allows
	 * the OIDC identity to participate in the existing auth middleware flow.
	 */
	public static createProvider = async (data: {
		org_id: string;
		provider_type: "github_actions" | "gitlab_ci" | "kubernetes" | "generic";
		issuer_url: string;
		audience: string;
		allowed_subjects?: string[];
	}): Promise<OidcProviderRow> => {
		const db = await DB.getInstance();

		const roles = await RoleService.getRoles(data.org_id);
		const machineRole = roles.find((r) => r.name === "CI/CD Machine") ?? roles.find((r) => !r.is_admin) ?? roles[0];

		let machineUserId: string | null = null;

		if (machineRole) {
			const id = uuidv4();
			const authServiceId = `oidc:${id}`;
			await db
				.insertInto("users")
				.values({
					id,
					is_active: true,
					email: `oidc-machine+${id.slice(0, 8)}@envsync.local`,
					org_id: data.org_id,
					role_id: machineRole.id,
					auth_service_id: authServiceId,
					full_name: `OIDC Machine [${data.provider_type}]`,
					profile_picture_url: null,
					created_at: new Date(),
					updated_at: new Date(),
				})
				.execute();

			await AuthorizationService.assignRoleToUser(id, data.org_id, machineRole.id);
			machineUserId = id;
		}

		const provider = await db
			.insertInto("oidc_providers")
			.values({
				id: uuidv4(),
				org_id: data.org_id,
				provider_type: data.provider_type,
				issuer_url: data.issuer_url,
				audience: data.audience,
				enabled: true,
				allowed_subjects: JSON.stringify(data.allowed_subjects ?? []),
				machine_user_id: machineUserId,
				created_at: new Date(),
				updated_at: new Date(),
			})
			.returningAll()
			.executeTakeFirstOrThrow();

		await invalidateCache(CacheKeys.oidcProvidersByOrg(data.org_id));

		return provider;
	};

	public static getProvider = async (id: string): Promise<OidcProviderRow> => {
		const db = await DB.getInstance();
		return orNotFound(
			db
				.selectFrom("oidc_providers")
				.selectAll()
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"OIDC Provider",
			id,
		);
	};

	public static getProvidersByOrg = async (orgId: string): Promise<OidcProviderRow[]> => {
		return cacheAside(CacheKeys.oidcProvidersByOrg(orgId), CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();
			return db
				.selectFrom("oidc_providers")
				.selectAll()
				.where("org_id", "=", orgId)
				.execute();
		});
	};

	/**
	 * Get all enabled providers across all orgs.
	 * Used by the auth middleware to match an incoming OIDC token.
	 */
	public static getAllEnabledProviders = async (): Promise<OidcProviderRow[]> => {
		return cacheAside("es:oidc:enabled", CacheTTL.SHORT, async () => {
			const db = await DB.getInstance();
			return db
				.selectFrom("oidc_providers")
				.selectAll()
				.where("enabled", "=", true)
				.execute();
		});
	};

	/**
	 * Find the provider (and its org) that matches a given issuer URL.
	 * Returns null if no enabled provider matches.
	 */
	public static findProviderByIssuer = async (
		issuerUrl: string,
	): Promise<OidcProviderRow | null> => {
		const db = await DB.getInstance();
		return (
			(await db
				.selectFrom("oidc_providers")
				.selectAll()
				.where("issuer_url", "=", issuerUrl)
				.where("enabled", "=", true)
				.executeTakeFirst()) ?? null
		);
	};

	public static updateProvider = async (
		id: string,
		data: {
			audience?: string;
			enabled?: boolean;
			allowed_subjects?: string[];
		},
	): Promise<void> => {
		const db = await DB.getInstance();

		const existing = await orNotFound(
			db
				.selectFrom("oidc_providers")
				.select(["org_id", "issuer_url"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"OIDC Provider",
			id,
		);

		const updateData: Record<string, unknown> = { updated_at: new Date() };
		if (data.audience !== undefined) updateData.audience = data.audience;
		if (data.enabled !== undefined) updateData.enabled = data.enabled;
		if (data.allowed_subjects !== undefined) updateData.allowed_subjects = JSON.stringify(data.allowed_subjects);

		await db
			.updateTable("oidc_providers")
			.set(updateData)
			.where("id", "=", id)
			.execute();

		await invalidateCache(
			CacheKeys.oidcProvidersByOrg(existing.org_id),
			"es:oidc:enabled",
		);
	};

	public static deleteProvider = async (id: string): Promise<void> => {
		const db = await DB.getInstance();

		const existing = await orNotFound(
			db
				.selectFrom("oidc_providers")
				.select(["org_id", "issuer_url", "machine_user_id"])
				.where("id", "=", id)
				.executeTakeFirstOrThrow(),
			"OIDC Provider",
			id,
		);

		await db.deleteFrom("oidc_providers").where("id", "=", id).executeTakeFirstOrThrow();

		// Clean up the machine user
		if (existing.machine_user_id) {
			try {
				const db2 = await DB.getInstance();
				await db2
					.updateTable("users")
					.set({ is_active: false })
					.where("id", "=", existing.machine_user_id)
					.execute();
			} catch {
				// Best-effort cleanup
			}
		}

		// Clear JWKS cache for this issuer
		clearJwksCache(existing.issuer_url);

		await invalidateCache(
			CacheKeys.oidcProvidersByOrg(existing.org_id),
			"es:oidc:enabled",
		);
	};
}

import { cacheAside, invalidateCache } from "@/helpers/cache";
import { CacheKeys, CacheTTL } from "@/helpers/cache-keys";
import { DB } from "@/libs/db";
import { NotFoundError } from "@/libs/errors";
import infoLogs, { LogTypes } from "@/libs/logger";
import { OrgService } from "@/services/org.service";
import { isEnterpriseFeature, type EnterpriseFeature } from "@/services/entitlement.types";
import {
	eeFeaturesForPlan,
	normalizeOverlayFeatures,
	parsePlanId,
	type HostedOverlayFlag,
	type PlanId,
	type PlanLimits,
} from "@/services/plan.catalog";

export type OrgFeatureGrantSource = "billing" | "support" | "seed";

export type OrgFeatureGrant = {
	org_id: string;
	plan: PlanId;
	features: EnterpriseFeature[];
	limits: PlanLimits | null;
	overlay_features: HostedOverlayFlag[];
	source: string;
	updated_by: string | null;
	created_at: string;
	updated_at: string;
};

type CachedGrant = { missing: true } | { missing: false; grant: OrgFeatureGrant };

type GrantTestOverrides = {
	grant?: (Omit<OrgFeatureGrant, "overlay_features"> & { overlay_features?: HostedOverlayFlag[] }) | null;
};

function isMissingGrantTable(error: unknown): boolean {
	const err = error as { code?: string; message?: string };
	if (err?.code === "42P01") {
		return true;
	}
	const message = err?.message ?? "";
	return /org_feature_grant/i.test(message) && /does not exist|undefined_table/i.test(message);
}

function toIso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeGrantFeatures(raw: readonly string[]): EnterpriseFeature[] {
	const seen = new Set<EnterpriseFeature>();
	for (const value of raw) {
		if (!isEnterpriseFeature(value) || value === "multi_org") {
			continue;
		}
		seen.add(value);
	}
	return [...seen];
}

function mapRow(row: {
	org_id: string;
	features: string[];
	plan?: string | null;
	limits?: unknown;
	overlay_features?: string[] | null;
	source: string;
	updated_by?: string | null;
	created_at: Date | string;
	updated_at: Date | string;
}): OrgFeatureGrant {
	return {
		org_id: row.org_id,
		plan: parsePlanId(row.plan, "developer"),
		features: normalizeGrantFeatures(row.features ?? []),
		limits: (row.limits as PlanLimits | null) ?? null,
		overlay_features: normalizeOverlayFeatures(row.overlay_features),
		source: row.source,
		updated_by: row.updated_by ?? null,
		created_at: toIso(row.created_at),
		updated_at: toIso(row.updated_at),
	};
}

function normalizeGrant(grant: OrgFeatureGrant): OrgFeatureGrant {
	return {
		...grant,
		overlay_features: normalizeOverlayFeatures(grant.overlay_features),
	};
}

export class OrgFeatureGrantService {
	static #testOverrides: GrantTestOverrides | null = null;

	public static setTestOverrides(overrides: GrantTestOverrides) {
		this.#testOverrides = { ...overrides };
	}

	public static clearTestOverrides() {
		this.#testOverrides = null;
	}

	/** `null` means no row (Hosted unrestricted). */
	public static async getGrant(orgId: string): Promise<OrgFeatureGrant | null> {
		if (this.#testOverrides) {
			const grant = this.#testOverrides.grant ?? null;
			return grant ? normalizeGrant(grant) : null;
		}

		try {
			const cached = await cacheAside<CachedGrant>(
				CacheKeys.orgFeatureGrant(orgId),
				CacheTTL.SHORT,
				async () => {
					const db = await DB.getInstance();
					const row = await db
						.selectFrom("org_feature_grant")
						.selectAll()
						.where("org_id", "=", orgId)
						.executeTakeFirst();
					if (!row) {
						return { missing: true };
					}
					return { missing: false, grant: mapRow(row) };
				},
			);
			return cached.missing ? null : cached.grant;
		} catch (error) {
			if (isMissingGrantTable(error)) {
				return null;
			}
			throw error;
		}
	}

	public static async replaceGrant(input: {
		orgId: string;
		features?: readonly string[];
		plan?: PlanId;
		overlay_features?: readonly string[];
		source?: string;
		updatedBy?: string | null;
	}): Promise<OrgFeatureGrant> {
		const plan = input.plan ?? "developer";
		const features = input.features
			? normalizeGrantFeatures(input.features)
			: eeFeaturesForPlan(plan);
		const overlay_features =
			input.overlay_features !== undefined
				? normalizeOverlayFeatures(input.overlay_features)
				: this.#testOverrides?.grant?.overlay_features ?? [];
		if (this.#testOverrides) {
			const now = new Date().toISOString();
			const grant: OrgFeatureGrant = {
				org_id: input.orgId,
				plan,
				features,
				limits: null,
				overlay_features,
				source: input.source ?? "billing",
				updated_by: input.updatedBy ?? null,
				created_at: this.#testOverrides.grant?.created_at ?? now,
				updated_at: now,
			};
			this.#testOverrides = { grant };
			return grant;
		}

		await OrgService.getOrg(input.orgId);
		const now = new Date();
		const source = input.source?.trim() || "billing";
		const updatedBy = input.updatedBy ?? null;

		try {
			const db = await DB.getInstance();
			const existing = await db
				.selectFrom("org_feature_grant")
				.select(["overlay_features"])
				.where("org_id", "=", input.orgId)
				.executeTakeFirst();
			const persistedOverlay =
				input.overlay_features !== undefined
					? overlay_features
					: normalizeOverlayFeatures(existing?.overlay_features);
			const row = await db
				.insertInto("org_feature_grant")
				.values({
					org_id: input.orgId,
					plan,
					features,
					overlay_features: persistedOverlay,
					source,
					updated_by: updatedBy,
					created_at: now,
					updated_at: now,
				})
				.onConflict(oc =>
					oc.column("org_id").doUpdateSet({
						plan,
						features,
						overlay_features: persistedOverlay,
						source,
						updated_by: updatedBy,
						updated_at: now,
					}),
				)
				.returningAll()
				.executeTakeFirstOrThrow();

			await invalidateCache(CacheKeys.orgFeatureGrant(input.orgId));
			infoLogs(
				`org_feature_grant_updated org=${input.orgId} source=${source} features=${features.join(",")} overlay=${persistedOverlay.join(",")}`,
				LogTypes.LOGS,
				"ENTITLEMENT",
			);
			return mapRow(row);
		} catch (error) {
			if (isMissingGrantTable(error)) {
				throw new NotFoundError("org_feature_grant");
			}
			throw error;
		}
	}

	/** Patch plan and/or overlay without replacing omitted fields. */
	public static async patchGrant(input: {
		orgId: string;
		plan?: PlanId;
		overlay_features?: readonly string[];
		features?: readonly string[];
		source?: string;
		updatedBy?: string | null;
	}): Promise<OrgFeatureGrant> {
		const current = await this.getGrant(input.orgId);
		return this.replaceGrant({
			orgId: input.orgId,
			plan: input.plan ?? current?.plan ?? "developer",
			features: input.features ?? current?.features,
			overlay_features: input.overlay_features ?? current?.overlay_features,
			source: input.source ?? current?.source ?? "support",
			updatedBy: input.updatedBy,
		});
	}

	public static async deleteGrant(orgId: string): Promise<boolean> {
		if (this.#testOverrides) {
			const existed = this.#testOverrides.grant !== null && this.#testOverrides.grant !== undefined;
			this.#testOverrides = { grant: null };
			return existed;
		}

		await OrgService.getOrg(orgId);

		try {
			const db = await DB.getInstance();
			const result = await db
				.deleteFrom("org_feature_grant")
				.where("org_id", "=", orgId)
				.executeTakeFirst();
			await invalidateCache(CacheKeys.orgFeatureGrant(orgId));
			infoLogs(`org_feature_grant_deleted org=${orgId}`, LogTypes.LOGS, "ENTITLEMENT");
			return Number(result.numDeletedRows ?? 0) > 0;
		} catch (error) {
			if (isMissingGrantTable(error)) {
				return false;
			}
			throw error;
		}
	}
}

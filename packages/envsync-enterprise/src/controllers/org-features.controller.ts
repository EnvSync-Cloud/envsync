import type { Context } from "hono";

import { ALL_ENTERPRISE_FEATURES } from "envsync-api/ports/helpers";
import { OrgFeatureGrantService, OrgService } from "envsync-api/ports/services";

function unrestrictedResponse(orgId: string) {
	return {
		org_id: orgId,
		unrestricted: true,
		plan: "enterprise",
		features: [...ALL_ENTERPRISE_FEATURES],
		source: null,
		updated_by: null,
		created_at: null,
		updated_at: null,
	};
}

export class OrgFeaturesController {
	public static readonly get = async (c: Context) => {
		const orgId = c.req.param("orgId");
		await OrgService.getOrg(orgId);
		const grant = await OrgFeatureGrantService.getGrant(orgId);
		if (!grant) {
			return c.json(unrestrictedResponse(orgId));
		}
		return c.json({
			org_id: grant.org_id,
			unrestricted: false,
			plan: grant.plan,
			features: grant.features,
			source: grant.source,
			updated_by: grant.updated_by,
			created_at: grant.created_at,
			updated_at: grant.updated_at,
		});
	};

	public static readonly put = async (c: Context) => {
		const orgId = c.req.param("orgId");
		const payload = c.req.valid("json" as never) as {
			plan?: "developer" | "plus" | "enterprise";
			features?: string[];
			source?: "billing" | "support" | "seed";
			updated_by?: string;
		};
		const grant = await OrgFeatureGrantService.replaceGrant({
			orgId,
			plan: payload.plan,
			features: payload.features,
			source: payload.source,
			updatedBy: payload.updated_by?.trim() || "platform",
		});
		return c.json({
			org_id: grant.org_id,
			unrestricted: false,
			plan: grant.plan,
			features: grant.features,
			source: grant.source,
			updated_by: grant.updated_by,
			created_at: grant.created_at,
			updated_at: grant.updated_at,
		});
	};

	public static readonly remove = async (c: Context) => {
		const orgId = c.req.param("orgId");
		await OrgFeatureGrantService.deleteGrant(orgId);
		return c.json(unrestrictedResponse(orgId));
	};
}

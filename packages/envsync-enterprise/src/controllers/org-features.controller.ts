import type { Context } from "hono";

import { OrgFeatureGrantService, OrgService } from "envsync-api/ports/services";

function unrestrictedResponse(orgId: string) {
	return {
		org_id: orgId,
		unrestricted: false,
		plan: "developer",
		features: [] as string[],
		overlay_features: [] as string[],
		source: null,
		updated_by: null,
		created_at: null,
		updated_at: null,
	};
}

function grantResponse(grant: {
	org_id: string;
	plan: string;
	features: string[];
	overlay_features: string[];
	source: string;
	updated_by: string | null;
	created_at: string;
	updated_at: string;
}) {
	return {
		org_id: grant.org_id,
		unrestricted: false,
		plan: grant.plan,
		features: grant.features,
		overlay_features: grant.overlay_features,
		source: grant.source,
		updated_by: grant.updated_by,
		created_at: grant.created_at,
		updated_at: grant.updated_at,
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
		return c.json(grantResponse(grant));
	};

	public static readonly put = async (c: Context) => {
		const orgId = c.req.param("orgId");
		const payload = c.req.valid("json" as never) as {
			plan?: "developer" | "plus" | "enterprise";
			features?: string[];
			overlay_features?: string[];
			source?: "billing" | "support" | "seed";
			updated_by?: string;
		};
		const grant = await OrgFeatureGrantService.patchGrant({
			orgId,
			plan: payload.plan,
			features: payload.features,
			overlay_features: payload.overlay_features,
			source: payload.source,
			updatedBy: payload.updated_by?.trim() || "platform",
		});
		return c.json(grantResponse(grant));
	};

	public static readonly remove = async (c: Context) => {
		const orgId = c.req.param("orgId");
		const grant = await OrgFeatureGrantService.replaceGrant({
			orgId,
			plan: "developer",
			overlay_features: [],
			source: "support",
			updatedBy: "platform",
		});
		return c.json(grantResponse(grant));
	};
}

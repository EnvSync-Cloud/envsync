import { config } from "@/utils/env";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { OrgFeatureGrantService } from "@/services/org-feature-grant.service";
import {
	applyOverlay,
	eeFeaturesForPlan,
	limitsForPlan,
	normalizeOverlayFeatures,
	parsePlanId,
	planChannel,
	type HostedOverlayFlag,
	type PlanId,
	type PlanLimits,
} from "@/services/plan.catalog";
import type { EnterpriseFeature } from "@/services/entitlement.types";

export type ResolvedPlan = {
	plan: PlanId;
	limits: PlanLimits;
	features: EnterpriseFeature[];
	overlay_features: HostedOverlayFlag[];
	source: string;
};

export class PlanService {
	public static installPlan(): PlanId {
		return parsePlanId(config.ENVSYNC_PLAN, "plus");
	}

	public static hostedMissingGrantPlan(): PlanId {
		return parsePlanId(config.ENVSYNC_HOSTED_DEFAULT_PLAN, "enterprise");
	}

	public static async resolve(orgId?: string | null): Promise<ResolvedPlan> {
		if (EditionPolicyService.isHosted() && orgId) {
			const grant = await OrgFeatureGrantService.getGrant(orgId);
			if (grant) {
				const plan = parsePlanId(grant.plan, "developer");
				const overlay = normalizeOverlayFeatures(grant.overlay_features);
				const baseFeatures = [...new Set([...eeFeaturesForPlan(plan), ...grant.features])];
				const applied = applyOverlay(grant.limits ?? limitsForPlan(plan, "hosted"), baseFeatures, overlay);
				return {
					plan,
					limits: applied.limits,
					features: applied.features,
					overlay_features: overlay,
					source: grant.source,
				};
			}
			const plan = this.hostedMissingGrantPlan();
			return {
				plan,
				limits: limitsForPlan(plan, "hosted"),
				features: eeFeaturesForPlan(plan),
				overlay_features: [],
				source: "hosted_default",
			};
		}

		const plan = this.installPlan();
		const channel = planChannel();
		return {
			plan,
			limits: limitsForPlan(plan, channel),
			features: EditionPolicyService.isOss() ? [] : eeFeaturesForPlan(plan),
			overlay_features: [],
			source: "install",
		};
	}
}

import { config } from "@/utils/env";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { OrgFeatureGrantService } from "@/services/org-feature-grant.service";
import {
	eeFeaturesForPlan,
	limitsForPlan,
	parsePlanId,
	planChannel,
	type PlanId,
	type PlanLimits,
} from "@/services/plan.catalog";
import type { EnterpriseFeature } from "@/services/entitlement.types";

export type ResolvedPlan = {
	plan: PlanId;
	limits: PlanLimits;
	features: EnterpriseFeature[];
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
				return {
					plan,
					limits: grant.limits ?? limitsForPlan(plan, "hosted"),
					features: grant.features.length > 0 ? grant.features : eeFeaturesForPlan(plan),
					source: grant.source,
				};
			}
			const plan = this.hostedMissingGrantPlan();
			return {
				plan,
				limits: limitsForPlan(plan, "hosted"),
				features: eeFeaturesForPlan(plan),
				source: "hosted_default",
			};
		}

		const plan = this.installPlan();
		const channel = planChannel();
		return {
			plan,
			limits: limitsForPlan(plan, channel),
			features: EditionPolicyService.isOss() ? [] : eeFeaturesForPlan(plan),
			source: "install",
		};
	}
}

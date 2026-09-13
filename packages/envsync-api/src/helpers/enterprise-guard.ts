import { ForbiddenError } from "@/libs/errors";
import { EditionPolicyService } from "@/services/edition-policy.service";
import { EntitlementService } from "@/services/entitlement.service";
import type { EnterpriseFeature } from "@/services/entitlement.types";

/**
 * Edition + (when enforcement) any valid entitlement.
 * Prefer {@link assertEntitled} for feature-specific routes.
 */
export async function assertEnterprise() {
	if (EditionPolicyService.isOss()) {
		throw new ForbiddenError(
			"This feature requires an enterprise license.",
			"ENTERPRISE_FEATURE_REQUIRED",
		);
	}

	if (EditionPolicyService.isHosted()) {
		return;
	}

	if (!EditionPolicyService.requiresEnterpriseLicense()) {
		if (!EditionPolicyService.isEnterprise()) {
			throw new ForbiddenError(
				"This feature requires an enterprise license.",
				"ENTERPRISE_FEATURE_REQUIRED",
			);
		}
		return;
	}

	const entitlement = await EntitlementService.resolve();
	if (!entitlement) {
		throw new ForbiddenError(
			"A valid enterprise entitlement is required for this feature.",
			"ENTITLEMENT_REQUIRED",
		);
	}
}

/** Install-ceiling feature gate. Use assertOrgFeature after auth for Hosted SKUs. */
export async function assertEntitled(feature: EnterpriseFeature) {
	await EntitlementService.assertFeature(feature);
}

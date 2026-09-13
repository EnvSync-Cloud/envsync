import type { Context, MiddlewareHandler, Next } from "hono";

import { AppError } from "@/libs/errors";
import { EntitlementService } from "@/services/entitlement.service";
import type { EnterpriseFeature } from "@/services/entitlement.types";

/**
 * Post-auth grant guard. Requires org_id on the context (do not run pre-auth).
 */
export const orgFeatureGuard = (feature: EnterpriseFeature): MiddlewareHandler => {
	return async (ctx: Context, next: Next) => {
		const orgId = ctx.get("org_id") as string | undefined;
		if (!orgId) {
			throw new AppError(
				"Organization context is required for this feature check.",
				500,
				"ORG_CONTEXT_REQUIRED",
			);
		}
		await EntitlementService.assertOrgFeature(orgId, feature);
		await next();
	};
};

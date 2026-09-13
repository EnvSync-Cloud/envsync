import type { Context, MiddlewareHandler, Next } from "hono";

import { EntitlementService } from "@/services/entitlement.service";
import type { EnterpriseFeature } from "@/services/entitlement.types";

/**
 * Install-ceiling guard only. Pair with orgFeatureGuard after auth on manage routes.
 */
export const enterpriseGuard = (feature: EnterpriseFeature = "management"): MiddlewareHandler => {
	return async (_ctx: Context, next: Next) => {
		await EntitlementService.assertFeature(feature);
		await next();
	};
};

import type { Context, MiddlewareHandler, Next } from "hono";

import { EntitlementService } from "@/services/entitlement.service";
import type { EnterpriseFeature } from "@/services/entitlement.types";

/**
 * Middleware that rejects requests when the deployment is not entitled for the feature.
 * Use on route groups that expose enterprise-only features (OIDC, SAML, rotation,
 * dynamic secrets, log forwarding, enterprise integrations).
 *
 * Phase 4: when `ENVSYNC_LICENSE_ENFORCEMENT=true` on self-host, requires a verified
 * entitlement JWT/claims with the named feature — not `ENVSYNC_EDITION` alone.
 */
export const enterpriseGuard = (feature: EnterpriseFeature = "management"): MiddlewareHandler => {
	return async (_ctx: Context, next: Next) => {
		await EntitlementService.assertFeature(feature);
		await next();
	};
};

import type { Context, MiddlewareHandler, Next } from "hono";

import { ForbiddenError } from "@/libs/errors";
import { EditionPolicyService } from "@/services/edition-policy.service";

/**
 * Middleware that rejects requests when the deployment is not enterprise edition.
 * Use on route groups that expose enterprise-only features (OIDC, SAML, rotation,
 * dynamic secrets, log forwarding, enterprise integrations).
 */
export const enterpriseGuard = (): MiddlewareHandler => {
	return async (_ctx: Context, next: Next) => {
		if (!EditionPolicyService.isEnterprise()) {
			throw new ForbiddenError(
				"This feature requires an enterprise license.",
				"ENTERPRISE_FEATURE_REQUIRED",
			);
		}

		await next();
	};
};

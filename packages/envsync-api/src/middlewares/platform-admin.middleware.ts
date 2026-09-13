import { timingSafeEqual } from "node:crypto";

import type { MiddlewareHandler } from "hono";

import { config } from "@/utils/env";
import { EditionPolicyService } from "@/services/edition-policy.service";

const PLATFORM_HEADER = "X-EnvSync-Platform-Token";

function tokensMatch(provided: string, expected: string) {
	const a = Buffer.from(provided);
	const b = Buffer.from(expected);
	if (a.length !== b.length) {
		return false;
	}
	return timingSafeEqual(a, b);
}

/**
 * Hosted server-to-server auth for org grants / break-glass.
 * Requires ENVSYNC_PLATFORM_ADMIN_TOKEN at request time (not boot).
 */
export function platformAdminMiddleware(): MiddlewareHandler {
	return async (ctx, next) => {
		if (!EditionPolicyService.isHosted()) {
			return ctx.json(
				{
					error: "Organization feature grants are only available on Hosted deployments.",
					code: "ORG_GRANTS_HOSTED_ONLY",
				},
				403,
			);
		}

		const expected = config.ENVSYNC_PLATFORM_ADMIN_TOKEN?.trim() ?? "";
		if (!expected) {
			return ctx.json(
				{
					error: "Platform admin token is not configured on this deployment.",
					code: "PLATFORM_TOKEN_NOT_CONFIGURED",
				},
				503,
			);
		}

		const provided = ctx.req.header(PLATFORM_HEADER)?.trim() ?? "";
		if (!provided || !tokensMatch(provided, expected)) {
			return ctx.json(
				{
					error: "Invalid or missing platform admin token.",
					code: "PLATFORM_TOKEN_INVALID",
				},
				401,
			);
		}

		await next();
	};
}

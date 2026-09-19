import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { OrgFeaturesController } from "../controllers/org-features.controller";
import { platformAdminMiddleware } from "envsync-api/ports/middlewares";
import { errorResponseSchema } from "envsync-api/ports/validators-common";
import {
	orgFeatureGrantParamSchema,
	orgFeatureGrantResponseSchema,
	putOrgFeatureGrantRequestSchema,
} from "../validators/org-features.validator";

const app = new Hono();

app.use(platformAdminMiddleware());

const platformTokenParam = {
	name: "X-EnvSync-Platform-Token",
	in: "header" as const,
	required: true,
	schema: { type: "string" as const },
};

app.get(
	"/:orgId",
	describeRoute({
		operationId: "getOrgFeatureGrant",
		summary: "Get Organization Feature Grant",
		description: "Hosted platform API. No row means unrestricted (full catalog).",
		tags: ["Org Features"],
		parameters: [platformTokenParam],
		responses: {
			200: {
				description: "Organization feature grant",
				content: { "application/json": { schema: resolver(orgFeatureGrantResponseSchema) } },
			},
			401: {
				description: "Invalid platform token",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			403: {
				description: "Not hosted",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("param", orgFeatureGrantParamSchema),
	OrgFeaturesController.get,
);

app.put(
	"/:orgId",
	describeRoute({
		operationId: "putOrgFeatureGrant",
		summary: "Replace Organization Feature Grant",
		description:
			"Patch plan and/or overlay_features. Omitted fields stay. Overlay is additive on the plan defaults and does not change numeric caps. Unknown catalog keys are dropped.",
		tags: ["Org Features"],
		parameters: [platformTokenParam],
		responses: {
			200: {
				description: "Organization feature grant replaced",
				content: { "application/json": { schema: resolver(orgFeatureGrantResponseSchema) } },
			},
			401: {
				description: "Invalid platform token",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			403: {
				description: "Not hosted",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("param", orgFeatureGrantParamSchema),
	zValidator("json", putOrgFeatureGrantRequestSchema),
	OrgFeaturesController.put,
);

app.delete(
	"/:orgId",
	describeRoute({
		operationId: "deleteOrgFeatureGrant",
		summary: "Delete Organization Feature Grant",
		description: "Resets the organization to the Developer plan with an empty overlay.",
		tags: ["Org Features"],
		parameters: [platformTokenParam],
		responses: {
			200: {
				description: "Grant deleted; organization unrestricted",
				content: { "application/json": { schema: resolver(orgFeatureGrantResponseSchema) } },
			},
			401: {
				description: "Invalid platform token",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			403: {
				description: "Not hosted",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("param", orgFeatureGrantParamSchema),
	OrgFeaturesController.remove,
);

export default app;

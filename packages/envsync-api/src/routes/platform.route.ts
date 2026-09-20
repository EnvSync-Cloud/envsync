import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { PlatformController } from "@/controllers/platform.controller";
import { platformAdminMiddleware } from "@/middlewares/platform-admin.middleware";
import {
	errorResponseSchema,
	platformProvisionRequestSchema,
	platformProvisionResponseSchema,
} from "@/validators/platform.validator";

const app = new Hono();

app.use("*", platformAdminMiddleware());

const platformTokenParam = {
	name: "X-EnvSync-Platform-Token",
	in: "header" as const,
	required: true,
	schema: { type: "string" as const },
};

app.post(
	"/organizations",
	describeRoute({
		operationId: "provisionPlatformOrganization",
		summary: "Provision a Hosted organization (SuperAdmin)",
		description:
			"Hosted platform API. existing_identity attaches a new org to a membership. fresh_tenant creates Keycloak user + org. Source is hosted_ops; per-user org caps are skipped.",
		tags: ["Platform"],
		parameters: [platformTokenParam],
		responses: {
			201: {
				description: "Organization provisioned",
				content: { "application/json": { schema: resolver(platformProvisionResponseSchema) } },
			},
			401: {
				description: "Invalid platform token",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			403: {
				description: "Not hosted",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			409: {
				description: "User or organization already exists",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", platformProvisionRequestSchema),
	PlatformController.provisionOrganization,
);

export default app;

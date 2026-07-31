import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { SetupController } from "@/controllers/setup.controller";
import { setupTokenMiddleware } from "@/middlewares/setup-token.middleware";
import { errorResponseSchema } from "@/validators/common";

import "zod-openapi/extend";

const createSetupOrgBodySchema = z
	.object({
		org_name: z.string().min(1).max(120),
		org_slug: z.string().min(1).max(120).optional(),
		admin_email: z.string().email(),
		admin_full_name: z.string().min(1).max(200).optional(),
		admin_password: z.string().min(8),
	})
	.openapi({ ref: "CreateSetupOrgRequest" });

const setupStatusSchema = z
	.object({
		deployment_mode: z.enum(["hosted", "selfhosted"]),
		edition: z.enum(["oss", "enterprise"]),
		org_count: z.number(),
		max_orgs: z.number().nullable(),
		can_create_organization: z.boolean(),
		first_org_ready: z.boolean(),
		channel: z.string(),
	})
	.openapi({ ref: "SetupStatusResponse" });

const app = new Hono();

app.use("*", setupTokenMiddleware());

app.get(
	"/status",
	describeRoute({
		operationId: "getSetupStatus",
		summary: "Operator setup status (self-host)",
		tags: ["Setup"],
		responses: {
			200: {
				description: "Setup status",
				content: { "application/json": { schema: resolver(setupStatusSchema) } },
			},
			401: {
				description: "Invalid setup token",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	SetupController.status,
);

app.post(
	"/org",
	describeRoute({
		operationId: "createSetupOrganization",
		summary: "Create organization via operator setup token (self-host only)",
		tags: ["Setup"],
		responses: {
			201: {
				description: "Organization created",
				content: {
					"application/json": {
						schema: resolver(
							z.object({
								message: z.string(),
								org_id: z.string(),
								admin_user_id: z.string(),
								source: z.string(),
								first_org: z.boolean(),
							}),
						),
					},
				},
			},
			400: {
				description: "Invalid request",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			401: {
				description: "Invalid setup token",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			403: {
				description: "Channel forbidden",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", createSetupOrgBodySchema),
	SetupController.createOrg,
);

export default app;

import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { authMiddleware } from "@/middlewares/auth.middleware";
import { OrgController } from "@/controllers/org.controller";
import {
	updateOrgRequestSchema,
	orgResponseSchema,
	checkSlugResponseSchema,
} from "@/validators/org.validator";
import { errorResponseSchema } from "@/validators/common";
import { cliMiddleware } from "@/middlewares/cli.middleware";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());

app.get(
	"/",
	describeRoute({
		operationId: "getOrg",
		summary: "Get Organization",
		description: "Retrieve the current organization's details",
		tags: ["Organizations"],
		responses: {
			200: {
				description: "Organization retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(orgResponseSchema),
					},
				},
			},
			500: {
				description: "Internal server error",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	OrgController.getOrg,
);

app.patch(
	"/",
	describeRoute({
		operationId: "updateOrg",
		summary: "Update Organization",
		description: "Update the current organization's details",
		tags: ["Organizations"],
		responses: {
			200: {
				description: "Organization updated successfully",
				content: {
					"application/json": {
						schema: resolver(orgResponseSchema),
					},
				},
			},
			500: {
				description: "Internal server error",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("json", updateOrgRequestSchema),
	OrgController.updateOrg,
);

app.get(
	"/check-slug",
	describeRoute({
		operationId: "checkIfSlugExists",
		summary: "Check Slug Availability",
		description: "Check if an organization slug is available",
		tags: ["Organizations"],
		parameters: [
			{
				name: "slug",
				in: "query",
				required: true,
				schema: { type: "string" },
				example: "my-organization",
			},
		],
		responses: {
			200: {
				description: "Slug availability checked successfully",
				content: {
					"application/json": {
						schema: resolver(checkSlugResponseSchema),
					},
				},
			},
			500: {
				description: "Internal server error",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	OrgController.checkIfSlugExists,
);

export default app;

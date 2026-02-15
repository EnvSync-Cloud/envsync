import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { authMiddleware } from "@/middlewares/auth.middleware";
import { requirePermission } from "@/middlewares/permission.middleware";
import { AppController } from "@/controllers/app.controller";
import { cliMiddleware } from "@/middlewares/cli.middleware";
import {
	createAppRequestBodySchema,
	createAppResponseSchema,
	getAppResponseSchema,
	getAppsResponseSchema,
	updateAppRequestBodySchema,
	updateAppResponseSchema,
	deleteAppResponseSchema,
} from "@/validators/app.validator";
import { errorResponseSchema } from "@/validators/common";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());

app.get(
	"/",
	describeRoute({
		operationId: "getApps",
		summary: "Get All Applications",
		description: "Retrieve all applications for the organization",
		tags: ["Applications"],
		responses: {
			200: {
				description: "Applications retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(getAppsResponseSchema),
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
	AppController.getApps,
);

app.get(
	"/:id",
	describeRoute({
		operationId: "getApp",
		summary: "Get Application",
		description: "Retrieve a specific application by ID",
		tags: ["Applications"],
		responses: {
			200: {
				description: "Application retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(getAppResponseSchema),
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
	AppController.getApp,
);

app.post(
	"/",
	describeRoute({
		operationId: "createApp",
		summary: "Create Application",
		description: "Create a new application",
		tags: ["Applications"],
		responses: {
			201: {
				description: "Application created successfully",
				content: {
					"application/json": {
						schema: resolver(createAppResponseSchema),
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
	zValidator("json", createAppRequestBodySchema),
	requirePermission("can_manage_apps", "org"),
	AppController.createApp,
);

app.patch(
	"/:id",
	describeRoute({
		operationId: "updateApp",
		summary: "Update Application",
		description: "Update an existing application",
		tags: ["Applications"],
		responses: {
			200: {
				description: "Application updated successfully",
				content: {
					"application/json": {
						schema: resolver(updateAppResponseSchema),
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
	zValidator("json", updateAppRequestBodySchema),
	requirePermission("can_manage_apps", "org"),
	AppController.updateApp,
);

app.delete(
	"/:id",
	describeRoute({
		operationId: "deleteApp",
		summary: "Delete Application",
		description: "Delete an existing application",
		tags: ["Applications"],
		responses: {
			200: {
				description: "Application deleted successfully",
				content: {
					"application/json": {
						schema: resolver(deleteAppResponseSchema),
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
	requirePermission("can_manage_apps", "org"),
	AppController.deleteApp,
);

export default app;

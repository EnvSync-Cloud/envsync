import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import {
	resolver,
	// validator as zValidator
} from "hono-openapi/zod";

import { authMiddleware } from "@/middlewares/auth.middleware";
import { EnvTypeController } from "@/controllers/env_type.controller";
import {
	createEnvTypeRequestSchema,
	updateEnvTypeRequestSchema,
	envTypeResponseSchema,
	envTypesResponseSchema,
	deleteEnvTypeRequestSchema,
} from "@/validators/env_type.validator";
import { errorResponseSchema } from "@/validators/common";
import { validator as zValidator } from "hono-openapi/zod";
import { cliMiddleware } from "@/middlewares/cli.middleware";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());

app.get(
	"/",
	describeRoute({
		operationId: "getEnvTypes",
		summary: "Get Environment Types",
		description: "Retrieve all environment types for the organization",
		tags: ["Environment Types"],
		responses: {
			200: {
				description: "Environment types retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(envTypesResponseSchema),
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
	EnvTypeController.getEnvTypes,
);

app.get(
	"/:id",
	describeRoute({
		operationId: "getEnvType",
		summary: "Get Environment Type",
		description: "Retrieve a specific environment type",
		tags: ["Environment Types"],
		responses: {
			200: {
				description: "Environment type retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(envTypeResponseSchema),
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
	EnvTypeController.getEnvType,
);

app.post(
	"/",
	describeRoute({
		operationId: "createEnvType",
		summary: "Create Environment Type",
		description: "Create a new environment type",
		tags: ["Environment Types"],
		responses: {
			201: {
				description: "Environment type created successfully",
				content: {
					"application/json": {
						schema: resolver(envTypeResponseSchema),
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
	zValidator("json", createEnvTypeRequestSchema),
	EnvTypeController.createEnvType,
);

app.patch(
	"/:id",
	describeRoute({
		operationId: "updateEnvType",
		summary: "Update Environment Type",
		description: "Update an existing environment type",
		tags: ["Environment Types"],
		responses: {
			200: {
				description: "Environment type updated successfully",
				content: {
					"application/json": {
						schema: resolver(envTypeResponseSchema),
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
	zValidator("json", updateEnvTypeRequestSchema),
	EnvTypeController.updateEnvType,
);

app.delete(
	"/:id",
	describeRoute({
		operationId: "deleteEnvType",
		summary: "Delete Environment Type",
		description: "Delete an existing environment type",
		tags: ["Environment Types"],
		responses: {
			200: {
				description: "Environment type deleted successfully",
				content: {
					"application/json": {
						schema: resolver(deleteEnvTypeRequestSchema),
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
	EnvTypeController.deleteEnvType,
);

export default app;

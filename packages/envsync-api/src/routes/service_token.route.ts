import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { ServiceTokenController } from "@/controllers/service_token.controller";
import { requirePermission } from "@/middlewares/permission.middleware";
import {
	createServiceTokenRequestSchema,
	createServiceTokenResponseSchema,
	serviceTokenResponseSchema,
	serviceTokensResponseSchema,
} from "@/validators/service_token.validator";
import { errorResponseSchema } from "@/validators/common";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { cliMiddleware } from "@/middlewares/cli.middleware";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());
app.use(requirePermission("can_manage_api_keys", "org"));

app.post(
	"/",
	describeRoute({
		operationId: "createServiceToken",
		summary: "Create Service Token",
		description: "Create a new scoped service token for the organization",
		tags: ["Service Tokens"],
		responses: {
			201: {
				description: "Service token created successfully",
				content: {
					"application/json": {
						schema: resolver(createServiceTokenResponseSchema),
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
	zValidator("json", createServiceTokenRequestSchema),
	ServiceTokenController.createToken,
);

app.get(
	"/:id",
	describeRoute({
		operationId: "getServiceToken",
		summary: "Get Service Token",
		description: "Retrieve a specific service token (does not return the raw token)",
		tags: ["Service Tokens"],
		responses: {
			200: {
				description: "Service token retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(serviceTokenResponseSchema),
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
	ServiceTokenController.getToken,
);

app.get(
	"/",
	describeRoute({
		operationId: "getAllServiceTokens",
		summary: "Get All Service Tokens",
		description: "Retrieve all service tokens for the organization",
		tags: ["Service Tokens"],
		responses: {
			200: {
				description: "Service tokens retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(serviceTokensResponseSchema),
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
	ServiceTokenController.getAllTokens,
);

app.delete(
	"/:id",
	describeRoute({
		operationId: "deleteServiceToken",
		summary: "Delete Service Token",
		description: "Delete an existing service token",
		tags: ["Service Tokens"],
		responses: {
			200: {
				description: "Service token deleted successfully",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
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
	ServiceTokenController.deleteToken,
);

export default app;

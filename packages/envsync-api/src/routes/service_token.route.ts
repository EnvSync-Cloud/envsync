import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { ServiceTokenController } from "@/controllers/service_token.controller";
import { requirePermission } from "@/middlewares/permission.middleware";
import {
	createServiceTokenRequestSchema,
	createServiceTokenResponseSchema,
	listServiceTokensQuerySchema,
	rotateServiceTokenRequestSchema,
	rotateServiceTokenResponseSchema,
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

app.post(
	"/:id/rotate",
	describeRoute({
		operationId: "rotateServiceToken",
		summary: "Rotate Service Token",
		description:
			"Issue a new esv_ token for an existing service token. The previous hash stays valid until the grace window ends (default 24h, 0–7 days).",
		tags: ["Service Tokens"],
		responses: {
			201: {
				description: "Service token rotated successfully",
				content: {
					"application/json": {
						schema: resolver(rotateServiceTokenResponseSchema),
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
	zValidator("json", rotateServiceTokenRequestSchema),
	ServiceTokenController.rotateToken,
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
		description: "Retrieve service tokens for the organization. Pass app_id to limit the list to one project.",
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
	zValidator("query", listServiceTokensQuerySchema),
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

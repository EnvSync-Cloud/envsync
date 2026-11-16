import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { ApiKeyController } from "@/controllers/api_key.controller";
import { requirePermission } from "@/middlewares/permission.middleware";
import {
	createApiKeyRequestSchema,
	createApiKeyResponseSchema,
	apiKeyResponseSchema,
	apiKeysResponseSchema,
	updateApiKeyRequestSchema,
	regenerateApiKeyResponseSchema,
} from "@/validators/api_key.validator";
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
		operationId: "createApiKey",
		summary: "Create API Key",
		description: "Create a new API key for the organization. The full key is returned only in this response.",
		tags: ["API Keys"],
		responses: {
			201: {
				description: "API key created successfully",
				content: {
					"application/json": {
						schema: resolver(createApiKeyResponseSchema),
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
	zValidator("json", createApiKeyRequestSchema),
	ApiKeyController.createApiKey,
);

app.get(
	"/:id",
	describeRoute({
		operationId: "getApiKey",
		summary: "Get API Key",
		description: "Retrieve API key metadata. The secret and its hash are not included.",
		tags: ["API Keys"],
		responses: {
			200: {
				description: "API key retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(apiKeyResponseSchema),
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
	ApiKeyController.getApiKey,
);

app.get(
	"/",
	describeRoute({
		operationId: "getAllApiKeys",
		summary: "Get All API Keys",
		description: "Retrieve API key metadata for the organization. Secrets and hashes are not included.",
		tags: ["API Keys"],
		responses: {
			200: {
				description: "API keys retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(apiKeysResponseSchema),
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
	ApiKeyController.getAllApiKeys,
);

app.put(
	"/:id",
	describeRoute({
		operationId: "updateApiKey",
		summary: "Update API Key",
		description: "Update an existing API key",
		tags: ["API Keys"],
		responses: {
			200: {
				description: "API key updated successfully",
				content: {
					"application/json": {
						schema: resolver(apiKeyResponseSchema),
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
	zValidator("json", updateApiKeyRequestSchema),
	ApiKeyController.updateApiKey,
);

app.delete(
	"/:id",
	describeRoute({
		operationId: "deleteApiKey",
		summary: "Delete API Key",
		description: "Delete an existing API key",
		tags: ["API Keys"],
		responses: {
			200: {
				description: "API key deleted successfully",
				content: {
					"application/json": {
						schema: resolver(apiKeyResponseSchema),
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
	ApiKeyController.deleteApiKey,
);

app.post(
	"/:id/regenerate",
	describeRoute({
		operationId: "regenerateApiKey",
		summary: "Regenerate API Key",
		description: "Rotate an existing API key. The previous secret stops working immediately. The new secret is returned once.",
		tags: ["API Keys"],
		responses: {
			200: {
				description: "API key regenerated successfully",
				content: {
					"application/json": {
						schema: resolver(regenerateApiKeyResponseSchema),
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
	ApiKeyController.regenerateApiKey,
);

export default app;

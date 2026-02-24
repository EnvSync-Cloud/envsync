import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { WebhookController } from "@/controllers/webhook.controller";
import { requirePermission } from "@/middlewares/permission.middleware";
import {
    createWebhookRequestSchema,
    webhookResponseSchema,
    webhooksResponseSchema,
    updateWebhookRequestSchema,
} from "@/validators/webhook.validator";
import { errorResponseSchema } from "@/validators/common";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { cliMiddleware } from "@/middlewares/cli.middleware";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());

app.post(
    "/",
    describeRoute({
        operationId: "createWebhook",
        summary: "Create Webhook",
        description: "Create a new webhook for the organization",
        tags: ["Webhooks"],
        responses: {
            201: {
                description: "Webhook created successfully",
                content: {
                    "application/json": {
                        schema: resolver(webhookResponseSchema),
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
    zValidator("json", createWebhookRequestSchema),
    requirePermission("can_manage_webhooks", "org"),
    WebhookController.createWebhook,
);

app.get(
    "/:id",
    describeRoute({
        operationId: "getWebhook",
        summary: "Get Webhook",
        description: "Retrieve a specific webhook",
        tags: ["Webhooks"],
        responses: {
            200: {
                description: "Webhook retrieved successfully",
                content: {
                    "application/json": {
                        schema: resolver(webhookResponseSchema),
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
    requirePermission("can_view", "org"),
    WebhookController.getWebhook,
);

app.get(
    "/",
    describeRoute({
        operationId: "getWebhooks",
        summary: "Get All Webhooks",
        description: "Retrieve all webhooks for the organization",
        tags: ["Webhooks"],
        responses: {
            200: {
                description: "Webhooks retrieved successfully",
                content: {
                    "application/json": {
                        schema: resolver(webhooksResponseSchema),
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
    requirePermission("can_view", "org"),
    WebhookController.getWebhooks,
);

app.put(
    "/:id",
    describeRoute({
        operationId: "updateWebhook",
        summary: "Update Webhook",
        description: "Update an existing webhook",
        tags: ["Webhooks"],
        responses: {
            200: {
                description: "Webhook updated successfully",
                content: {
                    "application/json": {
                        schema: resolver(webhookResponseSchema),
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
    zValidator("json", updateWebhookRequestSchema),
    requirePermission("can_manage_webhooks", "org"),
    WebhookController.updateWebhook,
);

app.delete(
    "/:id",
    describeRoute({
        operationId: "deleteWebhook",
        summary: "Delete Webhook",
        description: "Delete an existing webhook",
        tags: ["Webhooks"],
        responses: {
            200: {
                description: "Webhook deleted successfully",
                content: {
                    "application/json": {
                        schema: resolver(webhookResponseSchema),
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
    requirePermission("can_manage_webhooks", "org"),
    WebhookController.deleteWebhook,
);

export default app;
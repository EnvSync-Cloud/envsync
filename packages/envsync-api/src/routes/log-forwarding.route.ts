import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { LogForwardingController } from "@/controllers/log-forwarding.controller";
import { enterpriseGuard } from "@/middlewares/enterprise.middleware";
import { requirePermission } from "@/middlewares/permission.middleware";
import {
    createLogForwardingRequestSchema,
    logForwardingResponseSchema,
    logForwardingsResponseSchema,
} from "@/validators/log-forwarding.validator";
import { errorResponseSchema } from "@/validators/common";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { cliMiddleware } from "@/middlewares/cli.middleware";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());
app.use(enterpriseGuard());

app.post(
    "/",
    describeRoute({
        operationId: "createLogForwardingConfig",
        summary: "Create Log Forwarding Config",
        description: "Create a new log forwarding configuration for the organization",
        tags: ["Log Forwarding"],
        responses: {
            201: {
                description: "Log forwarding config created successfully",
                content: {
                    "application/json": {
                        schema: resolver(logForwardingResponseSchema),
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
    zValidator("json", createLogForwardingRequestSchema),
    requirePermission("can_view", "org"),
    LogForwardingController.createConfig,
);

app.get(
    "/",
    describeRoute({
        operationId: "getLogForwardingConfigs",
        summary: "Get All Log Forwarding Configs",
        description: "Retrieve all log forwarding configurations for the organization",
        tags: ["Log Forwarding"],
        responses: {
            200: {
                description: "Log forwarding configs retrieved successfully",
                content: {
                    "application/json": {
                        schema: resolver(logForwardingsResponseSchema),
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
    LogForwardingController.getConfigs,
);

app.get(
    "/:id",
    describeRoute({
        operationId: "getLogForwardingConfig",
        summary: "Get Log Forwarding Config",
        description: "Retrieve a specific log forwarding configuration",
        tags: ["Log Forwarding"],
        responses: {
            200: {
                description: "Log forwarding config retrieved successfully",
                content: {
                    "application/json": {
                        schema: resolver(logForwardingResponseSchema),
                    },
                },
            },
            404: {
                description: "Config not found",
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
    requirePermission("can_view", "org"),
    LogForwardingController.getConfig,
);

app.delete(
    "/:id",
    describeRoute({
        operationId: "deleteLogForwardingConfig",
        summary: "Delete Log Forwarding Config",
        description: "Delete a log forwarding configuration",
        tags: ["Log Forwarding"],
        responses: {
            200: {
                description: "Log forwarding config deleted successfully",
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
    requirePermission("can_view", "org"),
    LogForwardingController.deleteConfig,
);

export default app;

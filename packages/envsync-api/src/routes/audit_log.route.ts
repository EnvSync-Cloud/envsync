import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { authMiddleware } from "@/middlewares/auth.middleware";
import { requirePermission } from "@/middlewares/permission.middleware";
import { AuditLogController } from "@/controllers/audit_log.controller";
import {
	getAuditLogsQuerySchema,
	getAuditLogsResponseSchema,
} from "@/validators/audit_log.validator";
import { errorResponseSchema } from "@/validators/common";

const app = new Hono();

app.use(authMiddleware());

app.get(
	"/",
	describeRoute({
		operationId: "getAuditLogs",
		summary: "Get Audit Logs",
		description: "Retrieve audit logs for the organization with pagination",
		tags: ["Audit Logs"],
		responses: {
			200: {
				description: "Audit logs retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(getAuditLogsResponseSchema),
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
	zValidator("query", getAuditLogsQuerySchema),
	requirePermission("can_view_audit_logs", "org"),
	AuditLogController.getAuditLogs,
);

export default app;

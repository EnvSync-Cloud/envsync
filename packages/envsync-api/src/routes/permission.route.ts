import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { authMiddleware } from "@/middlewares/auth.middleware";
import { requirePermission } from "@/middlewares/permission.middleware";
import { PermissionController } from "@/controllers/permission.controller";
import {
	grantAccessRequestBodySchema,
	revokeAccessRequestBodySchema,
	permissionMessageResponseSchema,
	effectivePermissionsResponseSchema,
} from "@/validators/permission.validator";
import { errorResponseSchema } from "@/validators/common";

const app = new Hono();

app.use(authMiddleware());

// ─── Current user's effective permissions ──────────────────────────

app.get(
	"/me",
	describeRoute({
		operationId: "getMyPermissions",
		summary: "Get My Permissions",
		description: "Get the current user's effective permissions in the organization",
		tags: ["Permissions"],
		responses: {
			200: {
				description: "Permissions retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(effectivePermissionsResponseSchema),
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
	PermissionController.getMyPermissions,
);

// ─── App-level permissions ──────────────────────────────────────────

app.post(
	"/app/:app_id/grant",
	describeRoute({
		operationId: "grantAppAccess",
		summary: "Grant App Access",
		description: "Grant a user or team access to an app",
		tags: ["Permissions"],
		responses: {
			200: {
				description: "Access granted successfully",
				content: {
					"application/json": {
						schema: resolver(permissionMessageResponseSchema),
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
	zValidator("json", grantAccessRequestBodySchema),
	requirePermission("can_manage_apps", "org"),
	PermissionController.grantAppAccess,
);

app.post(
	"/app/:app_id/revoke",
	describeRoute({
		operationId: "revokeAppAccess",
		summary: "Revoke App Access",
		description: "Revoke a user or team's access to an app",
		tags: ["Permissions"],
		responses: {
			200: {
				description: "Access revoked successfully",
				content: {
					"application/json": {
						schema: resolver(permissionMessageResponseSchema),
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
	zValidator("json", revokeAccessRequestBodySchema),
	requirePermission("can_manage_apps", "org"),
	PermissionController.revokeAppAccess,
);

// ─── Env type-level permissions ──────────────────────────────────────

app.post(
	"/env_type/:id/grant",
	describeRoute({
		operationId: "grantEnvTypeAccess",
		summary: "Grant Env Type Access",
		description: "Grant a user or team access to an environment type",
		tags: ["Permissions"],
		responses: {
			200: {
				description: "Access granted successfully",
				content: {
					"application/json": {
						schema: resolver(permissionMessageResponseSchema),
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
	zValidator("json", grantAccessRequestBodySchema),
	requirePermission("can_manage_apps", "org"),
	PermissionController.grantEnvTypeAccess,
);

app.post(
	"/env_type/:id/revoke",
	describeRoute({
		operationId: "revokeEnvTypeAccess",
		summary: "Revoke Env Type Access",
		description: "Revoke a user or team's access to an environment type",
		tags: ["Permissions"],
		responses: {
			200: {
				description: "Access revoked successfully",
				content: {
					"application/json": {
						schema: resolver(permissionMessageResponseSchema),
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
	zValidator("json", revokeAccessRequestBodySchema),
	requirePermission("can_manage_apps", "org"),
	PermissionController.revokeEnvTypeAccess,
);

export default app;

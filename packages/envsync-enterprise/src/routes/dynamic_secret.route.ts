import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { authMiddleware } from "envsync-api/ports/middlewares";
import { enterpriseGuard } from "envsync-api/ports/middlewares";
import { requirePermission } from "envsync-api/ports/middlewares";
import { cliMiddleware } from "envsync-api/ports/middlewares";
import { DynamicSecretController } from "../controllers/dynamic_secret.controller";
import {
	createDynamicSecretEngineRequestSchema,
	updateDynamicSecretEngineRequestSchema,
	createLeaseRequestSchema,
	dynamicSecretEngineResponseSchema,
	dynamicSecretEnginesResponseSchema,
	dynamicSecretLeaseResponseSchema,
	dynamicSecretLeasesResponseSchema,
	revokeLeaseResponseSchema,
	cleanupResponseSchema,
} from "../validators/dynamic_secret.validator";
import { errorResponseSchema } from "envsync-api/ports/validators-common";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());
app.use(enterpriseGuard("dynamic_secrets"));

// ── Engine CRUD ─────────────────────────────────────────────────────────

app.post(
	"/engines",
	describeRoute({
		operationId: "createDynamicSecretEngine",
		summary: "Create Dynamic Secret Engine",
		description: "Create a new dynamic secret engine for short-lived credential generation",
		tags: ["Dynamic Secrets"],
		responses: {
			201: {
				description: "Engine created successfully",
				content: {
					"application/json": {
						schema: resolver(dynamicSecretEngineResponseSchema),
					},
				},
			},
			400: {
				description: "Validation error",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
			409: {
				description: "Engine name conflict",
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
	zValidator("json", createDynamicSecretEngineRequestSchema),
	requirePermission("can_manage_apps", "org"),
	DynamicSecretController.createEngine,
);

app.get(
	"/engines",
	describeRoute({
		operationId: "getAllDynamicSecretEngines",
		summary: "Get All Dynamic Secret Engines",
		description: "Retrieve all dynamic secret engines for the organization",
		tags: ["Dynamic Secrets"],
		responses: {
			200: {
				description: "Engines retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(dynamicSecretEnginesResponseSchema),
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
	DynamicSecretController.getAllEngines,
);

app.get(
	"/engines/:id",
	describeRoute({
		operationId: "getDynamicSecretEngine",
		summary: "Get Dynamic Secret Engine",
		description: "Retrieve a specific dynamic secret engine by ID",
		tags: ["Dynamic Secrets"],
		responses: {
			200: {
				description: "Engine retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(dynamicSecretEngineResponseSchema),
					},
				},
			},
			404: {
				description: "Engine not found",
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
	DynamicSecretController.getEngine,
);

app.patch(
	"/engines/:id",
	describeRoute({
		operationId: "updateDynamicSecretEngine",
		summary: "Update Dynamic Secret Engine",
		description: "Update an existing dynamic secret engine",
		tags: ["Dynamic Secrets"],
		responses: {
			200: {
				description: "Engine updated successfully",
				content: {
					"application/json": {
						schema: resolver(dynamicSecretEngineResponseSchema),
					},
				},
			},
			404: {
				description: "Engine not found",
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
	zValidator("json", updateDynamicSecretEngineRequestSchema),
	requirePermission("can_manage_apps", "org"),
	DynamicSecretController.updateEngine,
);

app.delete(
	"/engines/:id",
	describeRoute({
		operationId: "deleteDynamicSecretEngine",
		summary: "Delete Dynamic Secret Engine",
		description: "Delete a dynamic secret engine (must have no active leases)",
		tags: ["Dynamic Secrets"],
		responses: {
			200: {
				description: "Engine deleted successfully",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
			404: {
				description: "Engine not found",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
			409: {
				description: "Engine has active leases",
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
	requirePermission("can_manage_apps", "org"),
	DynamicSecretController.deleteEngine,
);

// ── Lease operations ────────────────────────────────────────────────────

app.post(
	"/engines/:id/leases",
	describeRoute({
		operationId: "createDynamicSecretLease",
		summary: "Create Dynamic Secret Lease",
		description: "Generate short-lived credentials by creating a lease on an engine",
		tags: ["Dynamic Secrets"],
		responses: {
			201: {
				description: "Lease created successfully",
				content: {
					"application/json": {
						schema: resolver(dynamicSecretLeaseResponseSchema),
					},
				},
			},
			400: {
				description: "Validation error",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
			404: {
				description: "Engine not found",
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
	zValidator("json", createLeaseRequestSchema),
	requirePermission("can_manage_apps", "org"),
	DynamicSecretController.createLease,
);

app.get(
	"/engines/:id/leases",
	describeRoute({
		operationId: "getDynamicSecretLeases",
		summary: "Get Leases for Engine",
		description: "Retrieve all leases for a specific dynamic secret engine",
		tags: ["Dynamic Secrets"],
		responses: {
			200: {
				description: "Leases retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(dynamicSecretLeasesResponseSchema),
					},
				},
			},
			404: {
				description: "Engine not found",
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
	DynamicSecretController.getLeasesByEngine,
);

app.get(
	"/leases/:leaseId",
	describeRoute({
		operationId: "getDynamicSecretLease",
		summary: "Get Dynamic Secret Lease",
		description: "Retrieve a specific lease by ID",
		tags: ["Dynamic Secrets"],
		responses: {
			200: {
				description: "Lease retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(dynamicSecretLeaseResponseSchema),
					},
				},
			},
			404: {
				description: "Lease not found",
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
	DynamicSecretController.getLease,
);

app.post(
	"/leases/:leaseId/revoke",
	describeRoute({
		operationId: "revokeDynamicSecretLease",
		summary: "Revoke Dynamic Secret Lease",
		description: "Revoke a lease and its associated credentials",
		tags: ["Dynamic Secrets"],
		responses: {
			200: {
				description: "Lease revoked successfully",
				content: {
					"application/json": {
						schema: resolver(revokeLeaseResponseSchema),
					},
				},
			},
			404: {
				description: "Lease not found",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
			409: {
				description: "Lease already revoked",
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
	requirePermission("can_manage_apps", "org"),
	DynamicSecretController.revokeLease,
);

app.post(
	"/leases/cleanup",
	describeRoute({
		operationId: "cleanupExpiredLeases",
		summary: "Cleanup Expired Leases",
		description: "Mark all expired leases as revoked (admin operation)",
		tags: ["Dynamic Secrets"],
		responses: {
			200: {
				description: "Cleanup completed",
				content: {
					"application/json": {
						schema: resolver(cleanupResponseSchema),
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
	DynamicSecretController.cleanupExpired,
);

export default app;

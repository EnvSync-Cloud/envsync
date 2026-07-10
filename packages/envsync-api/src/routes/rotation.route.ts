import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { authMiddleware } from "@/middlewares/auth.middleware";
import { enterpriseGuard } from "@/middlewares/enterprise.middleware";
import { RotationController } from "@/controllers/rotation.controller";
import {
	createRotationPolicySchema,
	updateRotationPolicySchema,
	rotationPolicyResponseSchema,
	rotationPoliciesResponseSchema,
	rotationStatesResponseSchema,
	triggerRotationResponseSchema,
	revokeOldCredentialResponseSchema,
	rotationIdParamSchema,
	getRotationPoliciesQuerySchema,
} from "@/validators/rotation.validator";
import { errorResponseSchema } from "@/validators/common";

const app = new Hono();

app.use(authMiddleware());
app.use(enterpriseGuard());

// ── Policy CRUD ─────────────────────────────────────────────────────────

app.post(
	"/",
	describeRoute({
		operationId: "createRotationPolicy",
		summary: "Create Rotation Policy",
		description: "Create a new secret rotation policy for a variable",
		tags: ["Rotation"],
		responses: {
			201: {
				description: "Rotation policy created successfully",
				content: { "application/json": { schema: resolver(rotationPolicyResponseSchema) } },
			},
			400: {
				description: "Bad request",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			403: {
				description: "Forbidden",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			409: {
				description: "Conflict - policy already exists",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", createRotationPolicySchema),
	RotationController.createPolicy,
);

app.get(
	"/",
	describeRoute({
		operationId: "getRotationPolicies",
		summary: "Get Rotation Policies",
		description: "List all rotation policies for the organization",
		tags: ["Rotation"],
		responses: {
			200: {
				description: "Rotation policies retrieved successfully",
				content: { "application/json": { schema: resolver(rotationPoliciesResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("query", getRotationPoliciesQuerySchema),
	RotationController.getPolicies,
);

app.get(
	"/:id",
	describeRoute({
		operationId: "getRotationPolicy",
		summary: "Get Rotation Policy",
		description: "Get a specific rotation policy by ID",
		tags: ["Rotation"],
		responses: {
			200: {
				description: "Rotation policy retrieved successfully",
				content: { "application/json": { schema: resolver(rotationPolicyResponseSchema) } },
			},
			404: {
				description: "Not found",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("param", rotationIdParamSchema),
	RotationController.getPolicy,
);

app.patch(
	"/:id",
	describeRoute({
		operationId: "updateRotationPolicy",
		summary: "Update Rotation Policy",
		description: "Update an existing rotation policy",
		tags: ["Rotation"],
		responses: {
			200: {
				description: "Rotation policy updated successfully",
				content: { "application/json": { schema: resolver(rotationPolicyResponseSchema) } },
			},
			403: {
				description: "Forbidden",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			404: {
				description: "Not found",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("param", rotationIdParamSchema),
	zValidator("json", updateRotationPolicySchema),
	RotationController.updatePolicy,
);

app.delete(
	"/:id",
	describeRoute({
		operationId: "deleteRotationPolicy",
		summary: "Delete Rotation Policy",
		description: "Delete a rotation policy",
		tags: ["Rotation"],
		responses: {
			200: {
				description: "Rotation policy deleted successfully",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			403: {
				description: "Forbidden",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			404: {
				description: "Not found",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("param", rotationIdParamSchema),
	RotationController.deletePolicy,
);

// ── Rotation Execution ──────────────────────────────────────────────────

app.post(
	"/:id/rotate",
	describeRoute({
		operationId: "triggerRotation",
		summary: "Trigger Rotation",
		description: "Manually trigger a secret rotation for a policy",
		tags: ["Rotation"],
		responses: {
			200: {
				description: "Rotation executed successfully",
				content: { "application/json": { schema: resolver(triggerRotationResponseSchema) } },
			},
			403: {
				description: "Forbidden",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			404: {
				description: "Not found",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			409: {
				description: "Conflict - policy disabled",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("param", rotationIdParamSchema),
	RotationController.triggerRotation,
);

// ── Rotation State ──────────────────────────────────────────────────────

app.get(
	"/:id/states",
	describeRoute({
		operationId: "getRotationStates",
		summary: "Get Rotation States",
		description: "Get the rotation state history for a policy",
		tags: ["Rotation"],
		responses: {
			200: {
				description: "Rotation states retrieved successfully",
				content: { "application/json": { schema: resolver(rotationStatesResponseSchema) } },
			},
			404: {
				description: "Not found",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("param", rotationIdParamSchema),
	RotationController.getRotationStates,
);

// ── Expired Credential Revocation ───────────────────────────────────────

app.post(
	"/revoke-expired",
	describeRoute({
		operationId: "revokeExpiredCredentials",
		summary: "Revoke Expired Credentials",
		description: "Revoke old credentials that have passed their dual-credential window",
		tags: ["Rotation"],
		responses: {
			200: {
				description: "Expired credentials revoked successfully",
				content: { "application/json": { schema: resolver(revokeOldCredentialResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	RotationController.revokeExpiredCredentials,
);

export default app;

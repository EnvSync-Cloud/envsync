import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { authMiddleware } from "@/middlewares/auth.middleware";
import { SecretController } from "@/controllers/secret.controller";
import {
	createSecretRequestSchema,
	updateSecretRequestSchema,
	deleteSecretRequestSchema,
	getSecretRequestSchema,
	batchSecretsRequestSchema,
	secretResponseSchema,
	secretsResponseSchema,
	batchSecretsDeleteRequestSchema,
	batchSecretsResponseSchema,
	revealSecretsRequestSchema,
	revealSecretsResponseSchema,
	secretHistoryRequestSchema,
	secretPitRequestSchema,
	secretTimestampRequestSchema,
	secretDiffRequestSchema,
	secretVariableTimelineRequestSchema,
	rollbackSecretsToPitRequestSchema,
	rollbackSecretsToTimestampRequestSchema,
	secretVariableRollbackToPitRequestSchema,
	secretVariableRollbackToTimestampRequestSchema,
	secretHistoryResponseSchema,
	secretPitStateResponseSchema,
	secretDiffResponseSchema,
	secretVariableTimelineResponseSchema,
	rollbackSecretsResponseSchema,
	secretVariableRollbackResponseSchema,
} from "@/validators/secret.validator";
import { errorResponseSchema } from "@/validators/common";
import { cliMiddleware } from "@/middlewares/cli.middleware";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());

// Note: Route-level requirePermission middleware is intentionally omitted here.
// Each controller method performs inline FGA authorization checks via
// AuthorizationService.check() against the specific env_type_id, which provides
// more granular, resource-level permission enforcement than route-level middleware
// could offer (e.g., can_view, can_edit, can_manage_protected per env_type).

// Basic CRUD routes
app.post(
	"/",
	describeRoute({
		operationId: "getSecrets",
		summary: "Get Secrets",
		description: "Retrieve all secrets for an application and environment type",
		tags: ["Secrets"],
		responses: {
			200: {
				description: "Secrets retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(secretsResponseSchema),
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
	zValidator("json", getSecretRequestSchema),
	SecretController.getSecrets,
);

app.post(
	"/i/:key",
	describeRoute({
		operationId: "getSecret",
		summary: "Get Single Secret",
		description: "Retrieve a specific secret",
		tags: ["Secrets"],
		responses: {
			200: {
				description: "Secret retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(secretResponseSchema),
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
	zValidator("json", getSecretRequestSchema),
	SecretController.getSecret,
);

app.put(
	"/single",
	describeRoute({
		operationId: "createSecret",
		summary: "Create Secret",
		description: "Create a new secret",
		tags: ["Secrets"],
		responses: {
			201: {
				description: "Secret created successfully",
				content: {
					"application/json": {
						schema: resolver(secretResponseSchema),
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
	zValidator("json", createSecretRequestSchema),
	SecretController.createSecret,
);

app.put(
	"/batch",
	describeRoute({
		operationId: "batchCreateSecrets",
		summary: "Batch Create Secrets",
		description: "Create multiple secrets in a single request",
		tags: ["Secrets"],
		responses: {
			201: {
				description: "Secrets created successfully",
				content: {
					"application/json": {
						schema: resolver(batchSecretsResponseSchema),
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
	zValidator("json", batchSecretsRequestSchema),
	SecretController.batchCreateSecrets,
);

app.delete(
	"/",
	describeRoute({
		operationId: "deleteSecret",
		summary: "Delete Secret",
		description: "Delete an existing secret",
		tags: ["Secrets"],
		responses: {
			200: {
				description: "Secret deleted successfully",
				content: {
					"application/json": {
						schema: resolver(batchSecretsResponseSchema),
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
	zValidator("json", deleteSecretRequestSchema),
	SecretController.deleteSecret,
);

app.patch(
	"/i/:key",
	describeRoute({
		operationId: "updateSecret",
		summary: "Update Secret",
		description: "Update an existing secret",
		tags: ["Secrets"],
		responses: {
			200: {
				description: "Secret updated successfully",
				content: {
					"application/json": {
						schema: resolver(batchSecretsResponseSchema),
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
	zValidator("json", updateSecretRequestSchema),
	SecretController.updateSecret,
);

app.patch(
	"/batch",
	describeRoute({
		operationId: "batchUpdateSecrets",
		summary: "Batch Update Secrets",
		description: "Update multiple secrets in a single request",
		tags: ["Secrets"],
		responses: {
			200: {
				description: "Secrets updated successfully",
				content: {
					"application/json": {
						schema: resolver(batchSecretsResponseSchema),
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
	zValidator("json", batchSecretsRequestSchema),
	SecretController.batchUpdateSecrets,
);

app.delete(
	"/batch",
	describeRoute({
		operationId: "deleteBatchSecrets",
		summary: "Batch Delete Secrets",
		description: "Delete multiple secrets in a single request",
		tags: ["Secrets"],
		responses: {
			200: {
				description: "Secrets deleted successfully",
				content: {
					"application/json": {
						schema: resolver(batchSecretsResponseSchema),
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
	zValidator("json", batchSecretsDeleteRequestSchema),
	SecretController.batchDeleteSecrets,
);

app.post(
	"/reveal",
	describeRoute({
		operationId: "revealSecrets",
		summary: "Reveal Secrets",
		description: "Decrypt and reveal secret values for managed apps",
		tags: ["Secrets"],
		responses: {
			200: {
				description: "Secrets revealed successfully",
				content: {
					"application/json": {
						schema: resolver(revealSecretsResponseSchema),
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
	zValidator("json", revealSecretsRequestSchema),
	SecretController.revealSecret,
);

// Point-in-Time routes
app.post(
	"/history",
	describeRoute({
		operationId: "getSecretHistory",
		summary: "Get Secrets History",
		description: "Retrieve paginated history of secret changes",
		tags: ["Secrets - Point in Time"],
		responses: {
			200: {
				description: "Secrets history retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(secretHistoryResponseSchema),
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
	zValidator("json", secretHistoryRequestSchema),
	SecretController.getSecretHistory,
);

app.post(
	"/pit",
	describeRoute({
		operationId: "getSecretsAtPointInTime",
		summary: "Get Secrets at Point in Time",
		description: "Retrieve secrets state at a specific point in time",
		tags: ["Secrets - Point in Time"],
		responses: {
			200: {
				description: "Secrets at point in time retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(secretPitStateResponseSchema),
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
	zValidator("json", secretPitRequestSchema),
	SecretController.getSecretsAtPointInTime,
);

app.post(
	"/timestamp",
	describeRoute({
		operationId: "getSecretsAtTimestamp",
		summary: "Get Secrets at Timestamp",
		description: "Retrieve secrets state at a specific timestamp",
		tags: ["Secrets - Point in Time"],
		responses: {
			200: {
				description: "Secrets at timestamp retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(secretPitStateResponseSchema),
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
	zValidator("json", secretTimestampRequestSchema),
	SecretController.getSecretsAtTimestamp,
);

app.post(
	"/diff",
	describeRoute({
		operationId: "getSecretDiff",
		summary: "Get Secrets Diff",
		description: "Compare secrets between two points in time",
		tags: ["Secrets - Point in Time"],
		responses: {
			200: {
				description: "Secrets diff retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(secretDiffResponseSchema),
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
	zValidator("json", secretDiffRequestSchema),
	SecretController.getSecretDiff,
);

app.post(
	"/timeline/:key",
	describeRoute({
		operationId: "getSecretVariableTimeline",
		summary: "Get Secret Variable Timeline",
		description: "Get timeline of changes for a specific secret variable",
		tags: ["Secrets - Point in Time"],
		responses: {
			200: {
				description: "Secret variable timeline retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(secretVariableTimelineResponseSchema),
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
	zValidator("json", secretVariableTimelineRequestSchema),
	SecretController.getSecretVariableTimeline,
);

// Rollback routes
app.post(
	"/rollback/pit",
	describeRoute({
		operationId: "rollbackSecretsToPitId",
		summary: "Rollback Secrets to Point in Time",
		description: "Rollback all secrets to a specific point in time",
		tags: ["Secrets - Rollback"],
		responses: {
			200: {
				description: "Secrets rolled back successfully",
				content: {
					"application/json": {
						schema: resolver(rollbackSecretsResponseSchema),
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
	zValidator("json", rollbackSecretsToPitRequestSchema),
	SecretController.rollbackSecretsToPitId,
);

app.post(
	"/rollback/timestamp",
	describeRoute({
		operationId: "rollbackSecretsToTimestamp",
		summary: "Rollback Secrets to Timestamp",
		description: "Rollback all secrets to a specific timestamp",
		tags: ["Secrets - Rollback"],
		responses: {
			200: {
				description: "Secrets rolled back successfully",
				content: {
					"application/json": {
						schema: resolver(rollbackSecretsResponseSchema),
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
	zValidator("json", rollbackSecretsToTimestampRequestSchema),
	SecretController.rollbackSecretsToTimestamp,
);

app.post(
	"/rollback/variable/:key/pit",
	describeRoute({
		operationId: "rollbackSecretVariableToPitId",
		summary: "Rollback Single Secret Variable to Point in Time",
		description: "Rollback a specific secret variable to a point in time",
		tags: ["Secrets - Rollback"],
		responses: {
			200: {
				description: "Secret variable rolled back successfully",
				content: {
					"application/json": {
						schema: resolver(secretVariableRollbackResponseSchema),
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
	zValidator("json", secretVariableRollbackToPitRequestSchema),
	SecretController.rollbackSecretVariableToPitId,
);

app.post(
	"/rollback/variable/:key/timestamp",
	describeRoute({
		operationId: "rollbackSecretVariableToTimestamp",
		summary: "Rollback Single Secret Variable to Timestamp",
		description: "Rollback a specific secret variable to a timestamp",
		tags: ["Secrets - Rollback"],
		responses: {
			200: {
				description: "Secret variable rolled back successfully",
				content: {
					"application/json": {
						schema: resolver(secretVariableRollbackResponseSchema),
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
	zValidator("json", secretVariableRollbackToTimestampRequestSchema),
	SecretController.rollbackSecretVariableToTimestamp,
);

export default app;

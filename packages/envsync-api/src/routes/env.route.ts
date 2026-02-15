import { Hono, type Context, type Next } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { authMiddleware } from "@/middlewares/auth.middleware";
import { EnvController } from "@/controllers/env.controller";
import {
	createEnvRequestSchema,
	updateEnvRequestSchema,
	deleteEnvRequestSchema,
	getEnvRequestSchema,
	batchEnvsRequestSchema,
	envResponseSchema,
	envsResponseSchema,
	batchEnvsDeleteRequestSchema,
	batchEnvsResponseSchema,
	envHistoryRequestSchema,
	envPitRequestSchema,
	envTimestampRequestSchema,
	envDiffRequestSchema,
	variableTimelineRequestSchema,
	rollbackToPitRequestSchema,
	rollbackToTimestampRequestSchema,
	variableRollbackToPitRequestSchema,
	variableRollbackToTimestampRequestSchema,
	envHistoryResponseSchema,
	envPitStateResponseSchema,
	envDiffResponseSchema,
	variableTimelineResponseSchema,
	rollbackResponseSchema,
	variableRollbackResponseSchema,
} from "@/validators/env.validator";
import { errorResponseSchema } from "@/validators/common";
import { cliMiddleware } from "@/middlewares/cli.middleware";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());

// Existing routes
app.post(
	"/",
	describeRoute({
		operationId: "getEnvs",
		summary: "Get Environment Variables",
		description: "Retrieve all environment variables for an application and environment type",
		tags: ["Environment Variables"],
		responses: {
			200: {
				description: "Environment variables retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(envsResponseSchema),
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
	zValidator("json", getEnvRequestSchema),
	EnvController.getEnvs,
);

app.post(
	"/i/:key",
	describeRoute({
		operationId: "getEnv",
		summary: "Get Single Environment Variable",
		description: "Retrieve a specific environment variable",
		tags: ["Environment Variables"],
		responses: {
			200: {
				description: "Environment variable retrieved successfully",

				content: {
					"application/json": {
						schema: resolver(envResponseSchema),
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
	zValidator("json", getEnvRequestSchema),
	EnvController.getEnv,
);

app.put(
	"/single",
	describeRoute({
		operationId: "createEnv",
		summary: "Create Environment Variable",
		description: "Create a new environment variable",
		tags: ["Environment Variables"],
		responses: {
			201: {
				description: "Environment variable created successfully",
				content: {
					"application/json": {
						schema: resolver(envResponseSchema),
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
	zValidator("json", createEnvRequestSchema),
	EnvController.createEnv,
);

app.put(
	"/batch",
	describeRoute({
		operationId: "batchCreateEnvs",
		summary: "Batch Create Environment Variables",
		description: "Create multiple environment variables in a single request",
		tags: ["Environment Variables"],
		responses: {
			201: {
				description: "Environment variables created successfully",
				content: {
					"application/json": {
						schema: resolver(batchEnvsResponseSchema),
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
	zValidator("json", batchEnvsRequestSchema),
	EnvController.batchCreateEnvs,
);

app.delete(
	"/",
	describeRoute({
		operationId: "deleteEnv",
		summary: "Delete Environment Variable",
		description: "Delete an existing environment variable",
		tags: ["Environment Variables"],
		responses: {
			200: {
				description: "Environment variable deleted successfully",
				content: {
					"application/json": {
						schema: resolver(deleteEnvRequestSchema),
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
	zValidator("json", deleteEnvRequestSchema),
	EnvController.deleteEnv,
);

app.patch(
	"/i/:key",
	describeRoute({
		operationId: "updateEnv",
		summary: "Update Environment Variable",
		description: "Update an existing environment variable",
		tags: ["Environment Variables"],
		responses: {
			200: {
				description: "Environment variable updated successfully",
				content: {
					"application/json": {
						schema: resolver(envResponseSchema),
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
	zValidator("json", updateEnvRequestSchema),
	EnvController.updateEnv,
);

app.patch(
	"/batch",
	describeRoute({
		operationId: "batchUpdateEnvs",
		summary: "Batch Update Environment Variables",
		description: "Update multiple environment variables in a single request",
		tags: ["Environment Variables"],
		responses: {
			200: {
				description: "Environment variables updated successfully",
				content: {
					"application/json": {
						schema: resolver(batchEnvsResponseSchema),
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
	zValidator("json", batchEnvsRequestSchema),
	EnvController.batchUpdateEnvs,
);

app.delete(
	"/batch",
	describeRoute({
		operationId: "deleteBatchEnv",
		summary: "Batch Delete Environment Variables",
		description: "Delete multiple environment variables in a single request",
		tags: ["Environment Variables"],
		responses: {
			200: {
				description: "Environment variables deleted successfully",
				content: {
					"application/json": {
						schema: resolver(batchEnvsResponseSchema),
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
	zValidator("json", batchEnvsDeleteRequestSchema),
	EnvController.batchDeleteEnvs,
);

// New Point-in-Time routes
app.post(
	"/history",
	describeRoute({
		operationId: "getEnvHistory",
		summary: "Get Environment Variables History",
		description: "Retrieve paginated history of environment variable changes",
		tags: ["Environment Variables - Point in Time"],
		responses: {
			200: {
				description: "Environment variables history retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(envHistoryResponseSchema),
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
	zValidator("json", envHistoryRequestSchema),
	EnvController.getEnvHistory,
);

app.post(
	"/pit",
	describeRoute({
		operationId: "getEnvsAtPointInTime",
		summary: "Get Environment Variables at Point in Time",
		description: "Retrieve environment variables state at a specific point in time",
		tags: ["Environment Variables - Point in Time"],
		responses: {
			200: {
				description: "Environment variables at point in time retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(envPitStateResponseSchema),
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
	zValidator("json", envPitRequestSchema),
	EnvController.getEnvsAtPointInTime,
);

app.post(
	"/timestamp",
	describeRoute({
		operationId: "getEnvsAtTimestamp",
		summary: "Get Environment Variables at Timestamp",
		description: "Retrieve environment variables state at a specific timestamp",
		tags: ["Environment Variables - Point in Time"],
		responses: {
			200: {
				description: "Environment variables at timestamp retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(envPitStateResponseSchema),
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
	zValidator("json", envTimestampRequestSchema),
	EnvController.getEnvsAtTimestamp,
);

app.post(
	"/diff",
	describeRoute({
		operationId: "getEnvDiff",
		summary: "Get Environment Variables Diff",
		description: "Compare environment variables between two points in time",
		tags: ["Environment Variables - Point in Time"],
		responses: {
			200: {
				description: "Environment variables diff retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(envDiffResponseSchema),
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
	zValidator("json", envDiffRequestSchema),
	EnvController.getEnvDiff,
);

app.post(
	"/timeline/:key",
	describeRoute({
		operationId: "getVariableTimeline",
		summary: "Get Variable Timeline",
		description: "Get timeline of changes for a specific environment variable",
		tags: ["Environment Variables - Point in Time"],
		responses: {
			200: {
				description: "Variable timeline retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(variableTimelineResponseSchema),
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
	zValidator("json", variableTimelineRequestSchema),
	EnvController.getVariableTimeline,
);

// Rollback routes
app.post(
	"/rollback/pit",
	describeRoute({
		operationId: "rollbackEnvsToPitId",
		summary: "Rollback Environment Variables to Point in Time",
		description: "Rollback all environment variables to a specific point in time",
		tags: ["Environment Variables - Rollback"],
		responses: {
			200: {
				description: "Environment variables rolled back successfully",
				content: {
					"application/json": {
						schema: resolver(rollbackResponseSchema),
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
	zValidator("json", rollbackToPitRequestSchema),
	EnvController.rollbackEnvsToPitId,
);

app.post(
	"/rollback/timestamp",
	describeRoute({
		operationId: "rollbackEnvsToTimestamp",
		summary: "Rollback Environment Variables to Timestamp",
		description: "Rollback all environment variables to a specific timestamp",
		tags: ["Environment Variables - Rollback"],
		responses: {
			200: {
				description: "Environment variables rolled back successfully",
				content: {
					"application/json": {
						schema: resolver(rollbackResponseSchema),
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
	zValidator("json", rollbackToTimestampRequestSchema),
	EnvController.rollbackEnvsToTimestamp,
);

app.post(
	"/rollback/variable/:key/pit",
	describeRoute({
		operationId: "rollbackVariableToPitId",
		summary: "Rollback Single Variable to Point in Time",
		description: "Rollback a specific environment variable to a point in time",
		tags: ["Environment Variables - Rollback"],
		responses: {
			200: {
				description: "Variable rolled back successfully",
				content: {
					"application/json": {
						schema: resolver(variableRollbackResponseSchema),
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
	zValidator("json", variableRollbackToPitRequestSchema),
	EnvController.rollbackVariableToPitId,
);

app.post(
	"/rollback/variable/:key/timestamp",
	describeRoute({
		operationId: "rollbackVariableToTimestamp",
		summary: "Rollback Single Variable to Timestamp",
		description: "Rollback a specific environment variable to a timestamp",
		tags: ["Environment Variables - Rollback"],
		responses: {
			200: {
				description: "Variable rolled back successfully",
				content: {
					"application/json": {
						schema: resolver(variableRollbackResponseSchema),
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
	zValidator("json", variableRollbackToTimestampRequestSchema),
	EnvController.rollbackVariableToTimestamp,
);

export default app;

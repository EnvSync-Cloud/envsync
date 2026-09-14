import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { ChangeRequestController } from "@/controllers/change_request.controller";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { errorResponseSchema } from "@/validators/common";
import {
	changeRequestListResponseSchema,
	changeRequestResponseSchema,
	directChangeRequestBodySchema,
	promotionChangeRequestBodySchema,
	rejectChangeRequestBodySchema,
} from "@/validators/change_request.validator";

const app = new Hono();

app.use(authMiddleware());

app.post(
	"/direct",
	describeRoute({
		operationId: "createDirectChangeRequest",
		summary: "Create Direct Change Request",
		description: "Create a protected-environment change request with explicit env and secret changes.",
		tags: ["Change Requests"],
		responses: {
			201: {
				description: "Direct change request created",
				content: { "application/json": { schema: resolver(changeRequestResponseSchema) } },
			},
			422: { description: "Validation error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	zValidator("json", directChangeRequestBodySchema),
	ChangeRequestController.createDirect,
);

app.post(
	"/promotion",
	describeRoute({
		operationId: "createPromotionChangeRequest",
		summary: "Create Promotion Change Request",
		description: "Create a promotion request from one app environment to another protected environment.",
		tags: ["Change Requests"],
		responses: {
			201: {
				description: "Promotion change request created",
				content: { "application/json": { schema: resolver(changeRequestResponseSchema) } },
			},
		},
	}),
	zValidator("json", promotionChangeRequestBodySchema),
	ChangeRequestController.createPromotion,
);

app.get(
	"/",
	describeRoute({
		operationId: "listChangeRequests",
		summary: "List Change Requests",
		description: "List change requests for the current organization. Pass app_id to limit the list to one project.",
		tags: ["Change Requests"],
		responses: {
			200: {
				description: "Change requests listed",
				content: { "application/json": { schema: resolver(changeRequestListResponseSchema) } },
			},
		},
	}),
	ChangeRequestController.list,
);

app.get(
	"/:id",
	describeRoute({
		operationId: "getChangeRequest",
		summary: "Get Change Request",
		description: "Fetch a single change request including env and secret item diffs.",
		tags: ["Change Requests"],
		responses: {
			200: {
				description: "Change request fetched",
				content: { "application/json": { schema: resolver(changeRequestResponseSchema) } },
			},
		},
	}),
	ChangeRequestController.get,
);

app.post(
	"/:id/approve",
	describeRoute({
		operationId: "approveChangeRequest",
		summary: "Approve Change Request",
		description: "Approve a pending change request and apply it atomically to the target environment.",
		tags: ["Change Requests"],
		responses: {
			200: {
				description: "Change request approved and applied",
				content: { "application/json": { schema: resolver(changeRequestResponseSchema) } },
			},
			404: { description: "Change request not found", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	ChangeRequestController.approve,
);
app.post(
	"/:id/reject",
	describeRoute({
		operationId: "rejectChangeRequest",
		summary: "Reject Change Request",
		description: "Reject a pending change request without mutating the target environment.",
		tags: ["Change Requests"],
		responses: {
			200: {
				description: "Change request rejected",
				content: { "application/json": { schema: resolver(changeRequestResponseSchema) } },
			},
			404: { description: "Change request not found", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	zValidator("json", rejectChangeRequestBodySchema),
	ChangeRequestController.reject,
);
app.post(
	"/:id/cancel",
	describeRoute({
		operationId: "cancelChangeRequest",
		summary: "Cancel Change Request",
		description: "Cancel a pending change request created by the current user.",
		tags: ["Change Requests"],
		responses: {
			200: {
				description: "Change request cancelled",
				content: { "application/json": { schema: resolver(changeRequestResponseSchema) } },
			},
			404: { description: "Change request not found", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	ChangeRequestController.cancel,
);

export default app;

import { Hono } from "hono";

import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { authMiddleware } from "@/middlewares/auth.middleware";
import { requirePermission } from "@/middlewares/permission.middleware";
import { OnboardingController } from "@/controllers/onboarding.controller";

import {
	acceptOrgInviteRequestBodySchema,
	acceptOrgInviteResponseSchema,
	acceptUserInviteRequestBodySchema,
	acceptUserInviteResponseSchema,
	createOrgInviteRequestBodySchema,
	createOrgInviteResponseSchema,
	createUserInviteRequestBodySchema,
	createUserInviteResponseSchema,
	deleteUserInviteResponseSchema,
	getOrgInviteByCodeResponseSchema,
	getUserInviteByTokenResponseSchema,
	updateUserInviteRequestBodySchema,
	updateUserInviteResponseSchema,
} from "@/validators/onboarding.validator";
import { errorResponseSchema } from "@/validators/common";

const app = new Hono();

app.post(
	"/org",
	describeRoute({
		operationId: "createOrgInvite",
		summary: "Create Organization Invite",
		description: "Create an organization invite",
		tags: ["Onboarding"],
		responses: {
			200: {
				description: "Successful greeting response",
				content: {
					"application/json": {
						schema: resolver(createOrgInviteResponseSchema),
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
	zValidator("json", createOrgInviteRequestBodySchema),
	OnboardingController.createOrgInvite,
);

app.get(
	"/org/:invite_code",
	describeRoute({
		operationId: "getOrgInviteByCode",
		summary: "Get Organization Invite by Code",
		description: "Get organization invite by code",
		tags: ["Onboarding"],
		responses: {
			200: {
				description: "Organization invite retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(getOrgInviteByCodeResponseSchema),
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
	OnboardingController.getOrgInviteByCode,
);
app.put(
	"/org/:invite_code/accept",
	describeRoute({
		operationId: "acceptOrgInvite",
		summary: "Accept Organization Invite",
		description: "Accept organization invite",
		tags: ["Onboarding"],
		responses: {
			200: {
				description: "Organization invite accepted successfully",
				content: {
					"application/json": {
						schema: resolver(acceptOrgInviteResponseSchema),
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
	zValidator("json", acceptOrgInviteRequestBodySchema),
	OnboardingController.acceptOrgInvite,
);

app.get(
	"/user/:invite_code",
	describeRoute({
		operationId: "getUserInviteByCode",
		summary: "Get User Invite by Code",
		description: "Get user invite by code",
		tags: ["Onboarding"],
		responses: {
			200: {
				description: "User invite retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(getUserInviteByTokenResponseSchema),
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
	OnboardingController.getUserInviteByCode,
);
app.put(
	"/user/:invite_code/accept",
	describeRoute({
		operationId: "acceptUserInvite",
		summary: "Accept User Invite",
		description: "Accept user invite",
		tags: ["Onboarding"],
		responses: {
			200: {
				description: "User invite accepted successfully",
				content: {
					"application/json": {
						schema: resolver(acceptUserInviteResponseSchema),
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
	zValidator("json", acceptUserInviteRequestBodySchema),
	OnboardingController.acceptUserInvite,
);

app.use(authMiddleware());
app.use(requirePermission("can_manage_invites", "org"));

app.post(
	"/user",
	describeRoute({
		operationId: "createUserInvite",
		summary: "Create User Invite",
		description: "Create a user invite",
		tags: ["Onboarding"],
		responses: {
			200: {
				description: "User invite created successfully",
				content: {
					"application/json": {
						schema: resolver(createUserInviteResponseSchema),
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
	zValidator("json", createUserInviteRequestBodySchema),
	OnboardingController.createUserInvite,
);

app.patch(
	"/user/:invite_code",
	describeRoute({
		operationId: "updateUserInvite",
		summary: "Update User Invite",
		description: "Update user invite",
		tags: ["Onboarding"],
		responses: {
			200: {
				description: "User invite updated successfully",
				content: {
					"application/json": {
						schema: resolver(updateUserInviteResponseSchema),
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
	zValidator("json", updateUserInviteRequestBodySchema),
	OnboardingController.updateUserInvite,
);
app.delete(
	"/user/:invite_id",
	describeRoute({
		operationId: "deleteUserInvite",
		summary: "Delete User Invite",
		description: "Delete user invite",
		tags: ["Onboarding"],
		responses: {
			200: {
				description: "User invite deleted successfully",
				content: {
					"application/json": {
						schema: resolver(deleteUserInviteResponseSchema),
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
	OnboardingController.deleteUserInvite,
);

app.get(
	"/user",
	describeRoute({
		operationId: "getAllUserInvites",
		summary: "Get All User Invites",
		description: "Get all user invites",
		tags: ["Onboarding"],
		responses: {
			200: {
				description: "User invites retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(getUserInviteByTokenResponseSchema),
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
	OnboardingController.getAllUserInvites,
);

export default app;

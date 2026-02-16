import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { authMiddleware } from "@/middlewares/auth.middleware";
import { requirePermission } from "@/middlewares/permission.middleware";
import { UserController } from "@/controllers/user.controller";
import {
	userResponseSchema,
	usersResponseSchema,
	updateUserRequestSchema,
	updateRoleRequestSchema,
} from "@/validators/user.validator";
import { errorResponseSchema } from "@/validators/common";
import { cliMiddleware } from "@/middlewares/cli.middleware";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());

app.get(
	"/",
	describeRoute({
		operationId: "getUsers",
		summary: "Get All Users",
		description: "Retrieve all users in the organization",
		tags: ["Users"],
		responses: {
			200: {
				description: "Users retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(usersResponseSchema),
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
	UserController.getUsers,
);

app.get(
	"/:id",
	describeRoute({
		operationId: "getUserById",
		summary: "Get User by ID",
		description: "Retrieve a specific user by their ID",
		tags: ["Users"],
		responses: {
			200: {
				description: "User retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(userResponseSchema),
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
	UserController.getUserById,
);

app.patch(
	"/:id",
	describeRoute({
		operationId: "updateUser",
		summary: "Update User",
		description: "Update a user's profile information",
		tags: ["Users"],
		responses: {
			200: {
				description: "User updated successfully",
				content: {
					"application/json": {
						schema: resolver(userResponseSchema),
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
	zValidator("json", updateUserRequestSchema),
	UserController.updateUser,
);

app.patch(
	"/role/:id",
	describeRoute({
		operationId: "updateRole",
		summary: "Update User Role",
		description: "Update a user's role (Admin only)",
		tags: ["Users"],
		responses: {
			200: {
				description: "User role updated successfully",
				content: {
					"application/json": {
						schema: resolver(userResponseSchema),
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
	zValidator("json", updateRoleRequestSchema),
	requirePermission("can_manage_users", "org"),
	UserController.updateRole,
);

app.patch(
	"/password/:id",
	describeRoute({
		operationId: "updatePassword",
		summary: "Update User Password",
		description: "Update a user's password (Admin only)",
		tags: ["Users"],
		responses: {
			200: {
				description: "Password update request sent successfully",
				content: {
					"application/json": {
						schema: resolver(userResponseSchema),
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
	UserController.updatePassword,
);

app.delete(
	"/:id",
	describeRoute({
		operationId: "deleteUser",
		summary: "Delete User",
		description: "Delete a user from the organization (Admin only)",
		tags: ["Users"],
		responses: {
			200: {
				description: "User deleted successfully",
				content: {
					"application/json": {
						schema: resolver(userResponseSchema),
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
	requirePermission("can_manage_users", "org"),
	UserController.deleteUser,
);

export default app;

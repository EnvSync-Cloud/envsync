import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";

import { AccessController } from "@/controllers/access.controller";
import { loginUrlResponseSchema, callbackResponseSchema } from "@/validators/access.validator";
import { errorResponseSchema } from "@/validators/common";

const app = new Hono();

app.get(
	"/cli",
	describeRoute({
		operationId: "createCliLogin",
		summary: "Initiate CLI Login",
		description: "Generate authentication URL for CLI login",
		tags: ["Access"],
		responses: {
			201: {
				description: "CLI login initiated successfully.",
				content: {
					"application/json": {
						schema: resolver(loginUrlResponseSchema),
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
	AccessController.createCliLogin,
);

app.get(
	"/web",
	describeRoute({
		operationId: "createWebLogin",
		summary: "Create Web Login URL",
		description: "Generate authentication URL for web login",
		tags: ["Access"],
		responses: {
			201: {
				description: "Web login URL created successfully",
				content: {
					"application/json": {
						schema: resolver(loginUrlResponseSchema),
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
	AccessController.createWebLogin,
);

app.get(
	"/web/callback",
	describeRoute({
		operationId: "callbackWebLogin",
		summary: "Web Login Callback",
		description: "Handle web login callback from Keycloak",
		tags: ["Access"],
		parameters: [
			{
				name: "code",
				in: "query",
				required: true,
				schema: { type: "string" },
			},
		],
		responses: {
			302: {
				description: "Redirect with authentication token",
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
	AccessController.callbackWebLogin,
);

app.get(
	"/api",
	describeRoute({
		operationId: "createApiLogin",
		summary: "Create API Login URL",
		description: "Generate authentication URL for API login",
		tags: ["Access"],
		responses: {
			201: {
				description: "API login URL created successfully",
				content: {
					"application/json": {
						schema: resolver(loginUrlResponseSchema),
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
	AccessController.createApiLogin,
);

app.get(
	"/api/callback",
	describeRoute({
		operationId: "callbackApiLogin",
		summary: "API Login Callback",
		description: "Handle API login callback from Keycloak",
		tags: ["Access"],
		parameters: [
			{
				name: "code",
				in: "query",
				required: true,
				schema: { type: "string" },
			},
		],
		responses: {
			200: {
				description: "API login callback successful",
				content: {
					"application/json": {
						schema: resolver(callbackResponseSchema),
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
	AccessController.callbackApiLogin,
);

export default app;

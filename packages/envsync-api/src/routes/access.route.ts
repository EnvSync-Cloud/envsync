import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver } from "hono-openapi/zod";

import { AccessController } from "@/controllers/access.controller";
import {
	loginUrlResponseSchema,
	callbackResponseSchema,
	cliSessionResponseSchema,
	logoutUrlResponseSchema,
	webSessionResponseSchema,
} from "@/validators/access.validator";
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

app.post(
	"/cli/session",
	describeRoute({
		operationId: "registerCliSession",
		summary: "Register CLI Session Device",
		description:
			"Record the CLI device for a DPoP-bound access token before later session requests. The proof is signed for this request and must match the token.",
		tags: ["Access"],
		responses: {
			200: {
				description: "CLI device registered",
				content: {
					"application/json": {
						schema: resolver(cliSessionResponseSchema),
					},
				},
			},
			401: {
				description: "DPoP proof or session token was not accepted",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	AccessController.registerCliSession,
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

app.get("/web/dev-session", AccessController.createDevWebSession);

app.get(
	"/web/callback",
	describeRoute({
		operationId: "callbackWebLogin",
		summary: "Web Login Callback",
		description: "Handle web login callback from Atrium",
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
				description: "Redirect after establishing the browser session",
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

app.post(
	"/web/exchange",
	describeRoute({
		operationId: "exchangeWebLogin",
		summary: "Exchange Web Login Code",
		description:
			"Exchange an authorization code and a DPoP proof for a browser session. The access token is returned once. The refresh token is stored in an HttpOnly cookie.",
		tags: ["Access"],
		responses: {
			200: {
				description: "Browser session created",
				content: {
					"application/json": {
						schema: resolver(webSessionResponseSchema),
					},
				},
			},
			400: {
				description: "Invalid login state",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
			401: {
				description: "DPoP proof or code exchange failed",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	AccessController.exchangeWebLogin,
);

app.post(
	"/web/refresh",
	describeRoute({
		operationId: "refreshWebSession",
		summary: "Refresh Web Session",
		description:
			"Rotate the browser refresh cookie and return a new DPoP-bound access token. The proof is signed for the identity token endpoint.",
		tags: ["Access"],
		responses: {
			200: {
				description: "Access token refreshed",
				content: {
					"application/json": {
						schema: resolver(webSessionResponseSchema),
					},
				},
			},
			401: {
				description: "Session expired",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	AccessController.refreshWebSession,
);

app.post(
	"/web/logout",
	describeRoute({
		operationId: "logoutWebLogin",
		summary: "Logout Web Session",
		description: "Clear API-managed web session cookies and return the Atrium logout URL",
		tags: ["Access"],
		responses: {
			200: {
				description: "Web logout prepared successfully",
				content: {
					"application/json": {
						schema: resolver(logoutUrlResponseSchema),
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
	AccessController.logoutWebLogin,
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
		description: "Handle API login callback from Atrium",
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

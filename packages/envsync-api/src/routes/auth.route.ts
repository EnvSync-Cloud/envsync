import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { authMiddleware } from "@/middlewares/auth.middleware";
import { AuthController } from "@/controllers/auth.controller";
import {
	createOrganizationRequestSchema,
	revokeSessionDeviceResponseSchema,
	sessionDeviceListSchema,
	switchOrgRequestSchema,
	whoAmIResponseSchema,
} from "@/validators/auth.validator";
import { errorResponseSchema } from "@/validators/common";
import { cliMiddleware } from "@/middlewares/cli.middleware";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());

app.get(
	"/me",
	describeRoute({
		operationId: "whoami",
		summary: "Get Current User",
		description:
			"Retrieve the current authenticated user's information and their organization details",
		tags: ["Authentication"],
		responses: {
			200: {
				description: "User information retrieved successfully",
				content: {
					"application/json": {
						schema: resolver(whoAmIResponseSchema),
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
	AuthController.whoami,
);

const createOrganizationRoute = describeRoute({
	operationId: "createOrganization",
	summary: "Create Organization",
	description:
		"Create a new organization for the current hosted web session and switch into it. Hosted only; self-host always 403.",
	tags: ["Authentication"],
	responses: {
		200: {
			description: "Organization created successfully",
			content: {
				"application/json": {
					schema: resolver(whoAmIResponseSchema),
				},
			},
		},
		400: {
			description: "Invalid request",
			content: {
				"application/json": {
					schema: resolver(errorResponseSchema),
				},
			},
		},
		401: {
			description: "Cookie session required",
			content: {
				"application/json": {
					schema: resolver(errorResponseSchema),
				},
			},
		},
		403: {
			description: "Not allowed on this deployment (e.g. self-host)",
			content: {
				"application/json": {
					schema: resolver(errorResponseSchema),
				},
			},
		},
		409: {
			description: "Organization slug conflict or org limit reached",
			content: {
				"application/json": {
					schema: resolver(errorResponseSchema),
				},
			},
		},
	},
});

/** Hosted dashboard org create (Phase 6 naming; Phase 7 removed create-workspace alias). */
app.post(
	"/create-organization",
	createOrganizationRoute,
	zValidator("json", createOrganizationRequestSchema),
	AuthController.createOrganization,
);

app.get(
	"/sessions",
	describeRoute({
		operationId: "listSessionDevices",
		summary: "List Signed-in Devices",
		description:
			"List browser and CLI sessions bound to the current user. The access token's device key is marked current.",
		tags: ["Authentication"],
		responses: {
			200: {
				description: "Signed-in devices",
				content: {
					"application/json": {
						schema: resolver(sessionDeviceListSchema),
					},
				},
			},
		},
	}),
	AuthController.listSessionDevices,
);

app.delete(
	"/sessions/:deviceId",
	describeRoute({
		operationId: "revokeSessionDevice",
		summary: "Sign Out a Device",
		description:
			"Reject further API calls from a device key. Signing out this browser also clears its refresh cookie.",
		tags: ["Authentication"],
		responses: {
			200: {
				description: "Device signed out",
				content: {
					"application/json": {
						schema: resolver(revokeSessionDeviceResponseSchema),
					},
				},
			},
			404: {
				description: "Device not found",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	AuthController.revokeSessionDevice,
);

app.post(
	"/switch-org",
	describeRoute({
		operationId: "switchOrg",
		summary: "Switch Active Organization",
		description: "Switch the active organization membership for the current web session",
		tags: ["Authentication"],
		responses: {
			200: {
				description: "Active organization switched successfully",
				content: {
					"application/json": {
						schema: resolver(whoAmIResponseSchema),
					},
				},
			},
			400: {
				description: "Invalid request",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
			401: {
				description: "Cookie session required",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
			403: {
				description: "User does not belong to the requested organization",
				content: {
					"application/json": {
						schema: resolver(errorResponseSchema),
					},
				},
			},
		},
	}),
	zValidator("json", switchOrgRequestSchema),
	AuthController.switchOrg,
);

export default app;

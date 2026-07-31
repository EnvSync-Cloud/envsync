import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { SamlController } from "@/controllers/saml.controller";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { enterpriseGuard } from "@/middlewares/enterprise.middleware";
import { requirePermission } from "@/middlewares/permission.middleware";
import {
	createSamlProviderRequestSchema,
	samlProviderResponseSchema,
	samlProvidersResponseSchema,
	updateSamlProviderRequestSchema,
	samlSsoRequestSchema,
	samlSsoResponseSchema,
} from "@/validators/saml.validator";
import { errorResponseSchema } from "@/validators/common";

const app = new Hono();

app.use(enterpriseGuard("saml"));

app.post(
	"/",
	describeRoute({
		operationId: "createSamlProvider",
		summary: "Register SAML Provider",
		description: "Register a new SAML identity provider for SSO authentication",
		tags: ["SAML Providers"],
		responses: {
			201: {
				description: "SAML provider created successfully",
				content: { "application/json": { schema: resolver(samlProviderResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	authMiddleware(),
	requirePermission("can_manage_api_keys", "org"),
	zValidator("json", createSamlProviderRequestSchema),
	SamlController.createProvider,
);

app.get(
	"/",
	describeRoute({
		operationId: "getAllSamlProviders",
		summary: "Get All SAML Providers",
		description: "Retrieve all SAML providers for the organization",
		tags: ["SAML Providers"],
		responses: {
			200: {
				description: "SAML providers retrieved successfully",
				content: { "application/json": { schema: resolver(samlProvidersResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	authMiddleware(),
	requirePermission("can_manage_api_keys", "org"),
	SamlController.getAllProviders,
);

app.get(
	"/:id",
	describeRoute({
		operationId: "getSamlProvider",
		summary: "Get SAML Provider",
		description: "Retrieve a specific SAML provider",
		tags: ["SAML Providers"],
		responses: {
			200: {
				description: "SAML provider retrieved successfully",
				content: { "application/json": { schema: resolver(samlProviderResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	authMiddleware(),
	requirePermission("can_manage_api_keys", "org"),
	SamlController.getProvider,
);

app.put(
	"/:id",
	describeRoute({
		operationId: "updateSamlProvider",
		summary: "Update SAML Provider",
		description: "Update an existing SAML provider",
		tags: ["SAML Providers"],
		responses: {
			200: {
				description: "SAML provider updated successfully",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	authMiddleware(),
	requirePermission("can_manage_api_keys", "org"),
	zValidator("json", updateSamlProviderRequestSchema),
	SamlController.updateProvider,
);

app.delete(
	"/:id",
	describeRoute({
		operationId: "deleteSamlProvider",
		summary: "Delete SAML Provider",
		description: "Delete an existing SAML provider",
		tags: ["SAML Providers"],
		responses: {
			200: {
				description: "SAML provider deleted successfully",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	authMiddleware(),
	requirePermission("can_manage_api_keys", "org"),
	SamlController.deleteProvider,
);

app.get(
	"/:id/metadata",
	describeRoute({
		operationId: "getSamlMetadata",
		summary: "Get SAML SP Metadata",
		description: "Retrieve SAML Service Provider metadata XML for the organization",
		tags: ["SAML Providers"],
		responses: {
			200: {
				description: "SP metadata XML",
				content: { "application/xml": { schema: { type: "string" } } },
			},
		},
	}),
	authMiddleware(),
	SamlController.getMetadata,
);

app.post(
	"/sso",
	describeRoute({
		operationId: "initiateSamlSso",
		summary: "Initiate SAML SSO",
		description: "Start SP-initiated SAML SSO flow by generating an AuthnRequest redirect URL",
		tags: ["SAML SSO"],
		responses: {
			200: {
				description: "Redirect URL generated",
				content: { "application/json": { schema: resolver(samlSsoResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	authMiddleware(),
	zValidator("json", samlSsoRequestSchema),
	SamlController.initiateSso,
);

app.post(
	"/acs/:orgId",
	describeRoute({
		operationId: "handleSamlAcs",
		summary: "SAML Assertion Consumer Service",
		description: "Receive and validate SAML Response from the identity provider (ACS endpoint)",
		tags: ["SAML SSO"],
		responses: {
			200: {
				description: "Authentication successful",
			},
			401: {
				description: "Authentication failed",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	SamlController.handleAcs,
);

export default app;

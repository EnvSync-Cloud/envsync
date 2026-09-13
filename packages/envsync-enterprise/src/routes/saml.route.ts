import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { SamlController } from "../controllers/saml.controller";
import { authMiddleware } from "envsync-api/ports/middlewares";
import { enterpriseGuard } from "envsync-api/ports/middlewares";
import { orgFeatureGuard } from "envsync-api/ports/middlewares";
import { requirePermission } from "envsync-api/ports/middlewares";
import {
	createSamlProviderRequestSchema,
	samlProviderResponseSchema,
	samlProvidersResponseSchema,
	updateSamlProviderRequestSchema,
} from "../validators/saml.validator";
import { errorResponseSchema } from "envsync-api/ports/validators-common";

const app = new Hono();

app.use(authMiddleware());
app.use(enterpriseGuard("saml"));
app.use(requirePermission("can_manage_org_settings", "org"));
app.use(orgFeatureGuard("saml"));

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
	SamlController.getAllProviders,
);

app.get(
	"/:id",
	describeRoute({
		operationId: "getSamlProvider",
		summary: "Get SAML Provider",
		description: "Retrieve a specific SAML provider. Certificate PEM is omitted unless include=certificate.",
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
	SamlController.deleteProvider,
);

app.get(
	"/:id/metadata",
	describeRoute({
		operationId: "getSamlMetadata",
		summary: "Get SAML SP Metadata",
		description: "Redirects to the public SP metadata URL for this organization",
		tags: ["SAML Providers"],
		responses: {
			302: {
				description: "Redirect to /api/saml/metadata/{orgId}",
			},
		},
	}),
	SamlController.getMetadata,
);

export default app;

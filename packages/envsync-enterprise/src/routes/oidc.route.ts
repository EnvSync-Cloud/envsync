import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { OidcController } from "../controllers/oidc.controller";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { enterpriseGuard } from "@/middlewares/enterprise.middleware";
import { requirePermission } from "@/middlewares/permission.middleware";
import {
	createOidcProviderRequestSchema,
	oidcProviderResponseSchema,
	oidcProvidersResponseSchema,
	updateOidcProviderRequestSchema,
} from "../validators/oidc.validator";
import { errorResponseSchema } from "@/validators/common";

const app = new Hono();

app.use(authMiddleware());
app.use(enterpriseGuard("oidc"));
app.use(requirePermission("can_manage_api_keys", "org"));

app.post(
	"/",
	describeRoute({
		operationId: "createOidcProvider",
		summary: "Register OIDC Provider",
		description: "Register a new OIDC provider for CI/CD machine authentication",
		tags: ["OIDC Providers"],
		responses: {
			201: {
				description: "OIDC provider created successfully",
				content: { "application/json": { schema: resolver(oidcProviderResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", createOidcProviderRequestSchema),
	OidcController.createProvider,
);

app.get(
	"/:id",
	describeRoute({
		operationId: "getOidcProvider",
		summary: "Get OIDC Provider",
		description: "Retrieve a specific OIDC provider",
		tags: ["OIDC Providers"],
		responses: {
			200: {
				description: "OIDC provider retrieved successfully",
				content: { "application/json": { schema: resolver(oidcProviderResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	OidcController.getProvider,
);

app.get(
	"/",
	describeRoute({
		operationId: "getAllOidcProviders",
		summary: "Get All OIDC Providers",
		description: "Retrieve all OIDC providers for the organization",
		tags: ["OIDC Providers"],
		responses: {
			200: {
				description: "OIDC providers retrieved successfully",
				content: { "application/json": { schema: resolver(oidcProvidersResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	OidcController.getAllProviders,
);

app.put(
	"/:id",
	describeRoute({
		operationId: "updateOidcProvider",
		summary: "Update OIDC Provider",
		description: "Update an existing OIDC provider",
		tags: ["OIDC Providers"],
		responses: {
			200: {
				description: "OIDC provider updated successfully",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	zValidator("json", updateOidcProviderRequestSchema),
	OidcController.updateProvider,
);

app.delete(
	"/:id",
	describeRoute({
		operationId: "deleteOidcProvider",
		summary: "Delete OIDC Provider",
		description: "Delete an existing OIDC provider",
		tags: ["OIDC Providers"],
		responses: {
			200: {
				description: "OIDC provider deleted successfully",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
			500: {
				description: "Internal server error",
				content: { "application/json": { schema: resolver(errorResponseSchema) } },
			},
		},
	}),
	OidcController.deleteProvider,
);

export default app;

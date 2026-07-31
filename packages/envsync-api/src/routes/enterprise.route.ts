import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import { EnterpriseController } from "@/controllers/enterprise.controller";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { cliMiddleware } from "@/middlewares/cli.middleware";
import { enterpriseGuard } from "@/middlewares/enterprise.middleware";
import { requirePermission } from "@/middlewares/permission.middleware";
import { errorResponseSchema } from "@/validators/common";
import {
	createEnvTypeMappingRequestSchema,
	createIntegrationBindingRequestSchema,
	createManualSyncRunRequestSchema,
	createOrgSecretRequestSchema,
	createProviderConnectionRequestSchema,
	enterpriseProvidersResponseSchema,
	envTypeMappingSchema,
	envTypeMappingsResponseSchema,
	integrationBindingSchema,
	integrationBindingsResponseSchema,
	orgSecretModelResponseSchema,
	orgSecretSchema,
	orgSecretsResponseSchema,
	providerConnectionSchema,
	providerConnectionsResponseSchema,
	syncAuditEventsResponseSchema,
	syncRunSchema,
	syncRunsResponseSchema,
	updateEnvTypeMappingRequestSchema,
	updateIntegrationBindingRequestSchema,
	updateOrgSecretRequestSchema,
	updateProviderConnectionRequestSchema,
} from "@/validators/enterprise.validator";

const app = new Hono();

app.use(authMiddleware());
app.use(cliMiddleware());
app.use(enterpriseGuard("integrations"));

app.get(
	"/providers",
	describeRoute({
		operationId: "listEnterpriseProviders",
		summary: "List Enterprise Providers",
		tags: ["Enterprise"],
		responses: {
			200: { description: "Enterprise provider catalog", content: { "application/json": { schema: resolver(enterpriseProvidersResponseSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	EnterpriseController.getProviders,
);

app.get(
	"/org-secrets/model",
	describeRoute({
		operationId: "getEnterpriseOrgSecretModel",
		summary: "Get Enterprise Org Secret Model",
		tags: ["Enterprise"],
		responses: {
			200: { description: "Org secret model", content: { "application/json": { schema: resolver(orgSecretModelResponseSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	EnterpriseController.getOrgSecretModel,
);

app.get(
	"/provider-connections",
	describeRoute({
		operationId: "listEnterpriseProviderConnections",
		summary: "List Enterprise Provider Connections",
		tags: ["Enterprise"],
		responses: {
			200: { description: "Provider connections", content: { "application/json": { schema: resolver(providerConnectionsResponseSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	requirePermission("can_manage_org_settings", "org"),
	EnterpriseController.listProviderConnections,
);

app.post(
	"/provider-connections",
	describeRoute({
		operationId: "createEnterpriseProviderConnection",
		summary: "Create Enterprise Provider Connection",
		tags: ["Enterprise"],
		responses: {
			201: { description: "Provider connection created", content: { "application/json": { schema: resolver(providerConnectionSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	zValidator("json", createProviderConnectionRequestSchema),
	requirePermission("can_manage_org_settings", "org"),
	EnterpriseController.createProviderConnection,
);

app.patch(
	"/provider-connections/:id",
	describeRoute({
		operationId: "updateEnterpriseProviderConnection",
		summary: "Update Enterprise Provider Connection",
		tags: ["Enterprise"],
		responses: {
			200: { description: "Provider connection updated", content: { "application/json": { schema: resolver(providerConnectionSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	zValidator("json", updateProviderConnectionRequestSchema),
	requirePermission("can_manage_org_settings", "org"),
	EnterpriseController.updateProviderConnection,
);

app.get(
	"/org-secrets",
	describeRoute({
		operationId: "listEnterpriseOrgSecrets",
		summary: "List Enterprise Org Secrets",
		tags: ["Enterprise"],
		responses: {
			200: { description: "Org secrets", content: { "application/json": { schema: resolver(orgSecretsResponseSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	requirePermission("can_manage_org_settings", "org"),
	EnterpriseController.listOrgSecrets,
);

app.post(
	"/org-secrets",
	describeRoute({
		operationId: "createEnterpriseOrgSecret",
		summary: "Create Enterprise Org Secret",
		tags: ["Enterprise"],
		responses: {
			201: { description: "Org secret created", content: { "application/json": { schema: resolver(orgSecretSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	zValidator("json", createOrgSecretRequestSchema),
	requirePermission("can_manage_org_settings", "org"),
	EnterpriseController.createOrgSecret,
);

app.patch(
	"/org-secrets/:id",
	describeRoute({
		operationId: "updateEnterpriseOrgSecret",
		summary: "Update Enterprise Org Secret",
		tags: ["Enterprise"],
		responses: {
			200: { description: "Org secret updated", content: { "application/json": { schema: resolver(orgSecretSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	zValidator("json", updateOrgSecretRequestSchema),
	requirePermission("can_manage_org_settings", "org"),
	EnterpriseController.updateOrgSecret,
);

app.get(
	"/apps/:app_id/bindings",
	describeRoute({
		operationId: "listEnterpriseIntegrationBindings",
		summary: "List Enterprise Integration Bindings",
		tags: ["Enterprise"],
		responses: {
			200: { description: "Integration bindings", content: { "application/json": { schema: resolver(integrationBindingsResponseSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	requirePermission("can_manage_apps", "org"),
	EnterpriseController.listBindings,
);

app.post(
	"/apps/:app_id/bindings",
	describeRoute({
		operationId: "createEnterpriseIntegrationBinding",
		summary: "Create Enterprise Integration Binding",
		tags: ["Enterprise"],
		responses: {
			201: { description: "Integration binding created", content: { "application/json": { schema: resolver(integrationBindingSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	zValidator("json", createIntegrationBindingRequestSchema),
	requirePermission("can_manage_apps", "org"),
	EnterpriseController.createBinding,
);

app.patch(
	"/apps/:app_id/bindings/:id",
	describeRoute({
		operationId: "updateEnterpriseIntegrationBinding",
		summary: "Update Enterprise Integration Binding",
		tags: ["Enterprise"],
		responses: {
			200: { description: "Integration binding updated", content: { "application/json": { schema: resolver(integrationBindingSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	zValidator("json", updateIntegrationBindingRequestSchema),
	requirePermission("can_manage_apps", "org"),
	EnterpriseController.updateBinding,
);

app.get(
	"/apps/:app_id/env-type-mappings",
	describeRoute({
		operationId: "listEnterpriseEnvTypeMappings",
		summary: "List Enterprise Env-Type Mappings",
		tags: ["Enterprise"],
		responses: {
			200: { description: "Env-type mappings", content: { "application/json": { schema: resolver(envTypeMappingsResponseSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	requirePermission("can_manage_apps", "org"),
	EnterpriseController.listMappings,
);

app.post(
	"/apps/:app_id/env-type-mappings",
	describeRoute({
		operationId: "createEnterpriseEnvTypeMapping",
		summary: "Create Enterprise Env-Type Mapping",
		tags: ["Enterprise"],
		responses: {
			201: { description: "Env-type mapping created", content: { "application/json": { schema: resolver(envTypeMappingSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	zValidator("json", createEnvTypeMappingRequestSchema),
	requirePermission("can_manage_apps", "org"),
	EnterpriseController.createMapping,
);

app.patch(
	"/apps/:app_id/env-type-mappings/:id",
	describeRoute({
		operationId: "updateEnterpriseEnvTypeMapping",
		summary: "Update Enterprise Env-Type Mapping",
		tags: ["Enterprise"],
		responses: {
			200: { description: "Env-type mapping updated", content: { "application/json": { schema: resolver(envTypeMappingSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	zValidator("json", updateEnvTypeMappingRequestSchema),
	requirePermission("can_manage_apps", "org"),
	EnterpriseController.updateMapping,
);

app.get(
	"/sync-runs",
	describeRoute({
		operationId: "listEnterpriseSyncRuns",
		summary: "List Enterprise Sync Runs",
		tags: ["Enterprise"],
		responses: {
			200: { description: "Sync runs", content: { "application/json": { schema: resolver(syncRunsResponseSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	requirePermission("can_manage_org_settings", "org"),
	EnterpriseController.listSyncRuns,
);

app.post(
	"/sync-runs/manual",
	describeRoute({
		operationId: "createEnterpriseManualSyncRun",
		summary: "Create Enterprise Manual Sync Run",
		tags: ["Enterprise"],
		responses: {
			201: { description: "Sync run created", content: { "application/json": { schema: resolver(syncRunSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	zValidator("json", createManualSyncRunRequestSchema),
	requirePermission("can_manage_org_settings", "org"),
	EnterpriseController.createManualSyncRun,
);

app.get(
	"/sync-runs/:sync_run_id/events",
	describeRoute({
		operationId: "listEnterpriseSyncAuditEvents",
		summary: "List Enterprise Sync Audit Events",
		tags: ["Enterprise"],
		responses: {
			200: { description: "Sync audit events", content: { "application/json": { schema: resolver(syncAuditEventsResponseSchema) } } },
			500: { description: "Internal server error", content: { "application/json": { schema: resolver(errorResponseSchema) } } },
		},
	}),
	requirePermission("can_manage_org_settings", "org"),
	EnterpriseController.listSyncAuditEvents,
);

export default app;

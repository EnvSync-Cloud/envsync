import z from "zod";

import "zod-openapi/extend";

const jsonRecordSchema = z.record(z.string(), z.any()).default({}).openapi({ type: "object" });

export const providerTypeSchema = z.enum([
	"github",
	"gitlab",
	"aws-ssm",
	"vercel",
	"google-secret-manager",
]);

export const enterpriseProviderProfileSchema = z.object({
	id: providerTypeSchema,
	name: z.string(),
	scope: z.string(),
	description: z.string(),
	connection_requirements: z.array(z.string()),
	binding_metadata_fields: z.array(z.string()),
	mapping_requirements: z.array(z.string()),
}).openapi({ ref: "EnterpriseProviderProfile" });

export const providerConnectionSchema = z.object({
	id: z.string(),
	org_id: z.string(),
	provider_type: providerTypeSchema,
	name: z.string(),
	status: z.enum(["active", "inactive", "error"]),
	auth_config: jsonRecordSchema,
	metadata: jsonRecordSchema,
	created_at: z.coerce.date(),
	updated_at: z.coerce.date(),
}).openapi({ ref: "ProviderConnection" });

export const orgSecretSchema = z.object({
	id: z.string(),
	org_id: z.string(),
	key: z.string(),
	value: z.string(),
	description: z.string().nullable().optional(),
	metadata: jsonRecordSchema,
	created_at: z.coerce.date(),
	updated_at: z.coerce.date(),
}).openapi({ ref: "OrgSecret" });

export const integrationBindingSchema = z.object({
	id: z.string(),
	org_id: z.string(),
	app_id: z.string(),
	provider_connection_id: z.string(),
	provider_type: providerTypeSchema,
	is_enabled: z.boolean(),
	metadata: jsonRecordSchema,
	created_at: z.coerce.date(),
	updated_at: z.coerce.date(),
}).openapi({ ref: "IntegrationBinding" });

export const envTypeMappingSchema = z.object({
	id: z.string(),
	org_id: z.string(),
	app_id: z.string(),
	env_type_id: z.string(),
	integration_binding_id: z.string(),
	target_identifier: z.string(),
	branch_ref: z.string().nullable().optional(),
	path_prefix: z.string().nullable().optional(),
	metadata: jsonRecordSchema,
	created_at: z.coerce.date(),
	updated_at: z.coerce.date(),
}).openapi({ ref: "EnvTypeMapping" });

export const syncRunSchema = z.object({
	id: z.string(),
	org_id: z.string(),
	app_id: z.string().nullable().optional(),
	provider_type: providerTypeSchema,
	status: z.enum(["pending", "running", "succeeded", "failed"]),
	actor_user_id: z.string().nullable().optional(),
	started_at: z.coerce.date(),
	completed_at: z.coerce.date().nullable().optional(),
	error_message: z.string().nullable().optional(),
	metadata: jsonRecordSchema,
	created_at: z.coerce.date(),
	updated_at: z.coerce.date(),
}).openapi({ ref: "SyncRun" });

export const syncAuditEventSchema = z.object({
	id: z.string(),
	org_id: z.string(),
	sync_run_id: z.string().nullable().optional(),
	app_id: z.string().nullable().optional(),
	env_type_id: z.string().nullable().optional(),
	provider_type: providerTypeSchema,
	action: z.string(),
	result: z.enum(["info", "success", "error"]),
	actor_user_id: z.string().nullable().optional(),
	details: jsonRecordSchema,
	created_at: z.coerce.date(),
	updated_at: z.coerce.date(),
}).openapi({ ref: "SyncAuditEvent" });

export const createProviderConnectionRequestSchema = z.object({
	provider_type: providerTypeSchema,
	name: z.string().min(1),
	status: z.enum(["active", "inactive", "error"]).optional(),
	auth_config: jsonRecordSchema.optional(),
	metadata: jsonRecordSchema.optional(),
}).openapi({ ref: "CreateProviderConnectionRequest" });

export const updateProviderConnectionRequestSchema = z.object({
	name: z.string().min(1).optional(),
	status: z.enum(["active", "inactive", "error"]).optional(),
	auth_config: jsonRecordSchema.optional(),
	metadata: jsonRecordSchema.optional(),
}).openapi({ ref: "UpdateProviderConnectionRequest" });

export const createOrgSecretRequestSchema = z.object({
	key: z.string().min(1),
	value: z.string().min(1),
	description: z.string().nullable().optional(),
	metadata: jsonRecordSchema.optional(),
}).openapi({ ref: "CreateOrgSecretRequest" });

export const updateOrgSecretRequestSchema = z.object({
	value: z.string().min(1).optional(),
	description: z.string().nullable().optional(),
	metadata: jsonRecordSchema.optional(),
}).openapi({ ref: "UpdateOrgSecretRequest" });

export const createIntegrationBindingRequestSchema = z.object({
	provider_connection_id: z.string().min(1),
	provider_type: providerTypeSchema,
	is_enabled: z.boolean().optional(),
	metadata: jsonRecordSchema.optional(),
}).openapi({ ref: "CreateIntegrationBindingRequest" });

export const updateIntegrationBindingRequestSchema = z.object({
	is_enabled: z.boolean().optional(),
	metadata: jsonRecordSchema.optional(),
}).openapi({ ref: "UpdateIntegrationBindingRequest" });

export const createEnvTypeMappingRequestSchema = z.object({
	env_type_id: z.string().min(1),
	integration_binding_id: z.string().min(1),
	target_identifier: z.string().min(1),
	branch_ref: z.string().nullable().optional(),
	path_prefix: z.string().nullable().optional(),
	metadata: jsonRecordSchema.optional(),
}).openapi({ ref: "CreateEnvTypeMappingRequest" });

export const updateEnvTypeMappingRequestSchema = z.object({
	target_identifier: z.string().min(1).optional(),
	branch_ref: z.string().nullable().optional(),
	path_prefix: z.string().nullable().optional(),
	metadata: jsonRecordSchema.optional(),
}).openapi({ ref: "UpdateEnvTypeMappingRequest" });

export const createManualSyncRunRequestSchema = z.object({
	app_id: z.string().nullable().optional(),
	provider_type: providerTypeSchema,
	metadata: jsonRecordSchema.optional(),
}).openapi({ ref: "CreateManualSyncRunRequest" });

export const providerConnectionsResponseSchema = z.array(providerConnectionSchema).openapi({ ref: "ProviderConnectionsResponse" });
export const orgSecretsResponseSchema = z.array(orgSecretSchema).openapi({ ref: "OrgSecretsResponse" });
export const integrationBindingsResponseSchema = z.array(integrationBindingSchema).openapi({ ref: "IntegrationBindingsResponse" });
export const envTypeMappingsResponseSchema = z.array(envTypeMappingSchema).openapi({ ref: "EnvTypeMappingsResponse" });
export const syncRunsResponseSchema = z.array(syncRunSchema).openapi({ ref: "SyncRunsResponse" });
export const syncAuditEventsResponseSchema = z.array(syncAuditEventSchema).openapi({ ref: "SyncAuditEventsResponse" });

export const enterpriseProvidersResponseSchema = z.object({
	providers: z.array(enterpriseProviderProfileSchema),
}).openapi({ ref: "EnterpriseProvidersResponse" });

export const orgSecretModelResponseSchema = z.object({
	resource: z.literal("org_secret"),
	description: z.string(),
	fields: z.array(z.string()),
}).openapi({ ref: "OrgSecretModelResponse" });

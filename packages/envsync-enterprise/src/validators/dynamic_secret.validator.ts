import z from "zod";
import "zod-openapi/extend";

// Engine type enum
const engineTypeSchema = z.enum(["postgres", "mysql", "aws-iam", "azure-sp"]);

// Postgres engine config
const postgresConfigSchema = z.object({
	host: z.string().openapi({ example: "db.example.com" }),
	port: z.number().int().default(5432).openapi({ example: 5432 }),
	database: z.string().openapi({ example: "mydb" }),
	superuser: z.object({
		username: z.string().openapi({ example: "admin" }),
		password: z.string().openapi({ example: "supersecret" }),
	}),
	creation_statements: z.array(z.string()).default([
		"CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';",
		"GRANT CONNECT ON DATABASE \"{{database}}\" TO \"{{name}}\";",
	]).openapi({ example: ["CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}';"] }),
	default_ttl_seconds: z.number().int().min(60).max(86400).default(3600).openapi({ example: 3600 }),
	max_ttl_seconds: z.number().int().min(60).max(604800).default(86400).openapi({ example: 86400 }),
});

// MySQL engine config
const mysqlConfigSchema = z.object({
	host: z.string().openapi({ example: "db.example.com" }),
	port: z.number().int().default(3306).openapi({ example: 3306 }),
	database: z.string().openapi({ example: "mydb" }),
	superuser: z.object({
		username: z.string().openapi({ example: "root" }),
		password: z.string().openapi({ example: "supersecret" }),
	}),
	creation_statements: z.array(z.string()).default([
		"CREATE USER '{{name}}'@'%' IDENTIFIED BY '{{password}}';",
		"GRANT SELECT ON {{database}}.* TO '{{name}}'@'%';",
	]).openapi({ example: ["CREATE USER '{{name}}'@'%' IDENTIFIED BY '{{password}}';"] }),
	default_ttl_seconds: z.number().int().min(60).max(86400).default(3600).openapi({ example: 3600 }),
	max_ttl_seconds: z.number().int().min(60).max(604800).default(86400).openapi({ example: 86400 }),
});

// AWS IAM engine config
const awsIamConfigSchema = z.object({
	access_key_id: z.string().openapi({ example: "AKIAIOSFODNN7EXAMPLE" }),
	secret_access_key: z.string().openapi({ example: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" }),
	region: z.string().default("us-east-1").openapi({ example: "us-east-1" }),
	iam_policy: z.string().openapi({ example: '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"s3:*","Resource":"*"}]}' }),
	default_ttl_seconds: z.number().int().min(900).max(43200).default(3600).openapi({ example: 3600 }),
	max_ttl_seconds: z.number().int().min(900).max(43200).default(43200).openapi({ example: 43200 }),
});

// Azure SP engine config
const azureSpConfigSchema = z.object({
	tenant_id: z.string().openapi({ example: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }),
	client_id: z.string().openapi({ example: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }),
	client_secret: z.string().openapi({ example: "supersecret" }),
	subscription_id: z.string().openapi({ example: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }),
	roles: z.array(z.string()).default(["Contributor"]).openapi({ example: ["Contributor"] }),
	default_ttl_seconds: z.number().int().min(300).max(86400).default(3600).openapi({ example: 3600 }),
	max_ttl_seconds: z.number().int().min(300).max(604800).default(86400).openapi({ example: 86400 }),
});

// Discriminated union for engine config based on engine_type
const engineConfigSchema = z.union([
	postgresConfigSchema,
	mysqlConfigSchema,
	awsIamConfigSchema,
	azureSpConfigSchema,
]);

// Request schemas
export const createDynamicSecretEngineRequestSchema = z
	.object({
		engine_type: engineTypeSchema.openapi({ example: "postgres" }),
		name: z.string().min(1).max(100).openapi({ example: "my-postgres-engine" }),
		config: engineConfigSchema,
		enabled: z.boolean().default(true).openapi({ example: true }),
	})
	.openapi({ ref: "CreateDynamicSecretEngineRequest" });

export const updateDynamicSecretEngineRequestSchema = z
	.object({
		name: z.string().min(1).max(100).optional().openapi({ example: "my-postgres-engine" }),
		config: engineConfigSchema.optional(),
		enabled: z.boolean().optional().openapi({ example: true }),
	})
	.openapi({ ref: "UpdateDynamicSecretEngineRequest" });

export const createLeaseRequestSchema = z
	.object({
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		variable_key: z.string().min(1).max(255).openapi({ example: "DATABASE_URL" }),
		ttl_seconds: z.number().int().min(60).max(604800).optional().openapi({ example: 3600 }),
	})
	.openapi({ ref: "CreateDynamicSecretLeaseRequest" });

// Response schemas
export const dynamicSecretEngineResponseSchema = z
	.object({
		id: z.string().openapi({ example: "engine_123" }),
		org_id: z.string().openapi({ example: "org_123" }),
		engine_type: engineTypeSchema.openapi({ example: "postgres" }),
		name: z.string().openapi({ example: "my-postgres-engine" }),
		config: z.record(z.unknown()).openapi({ example: { host: "db.example.com", port: 5432 } }),
		enabled: z.boolean().openapi({ example: true }),
		created_at: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "DynamicSecretEngineResponse" });

export const dynamicSecretEnginesResponseSchema = z
	.array(dynamicSecretEngineResponseSchema)
	.openapi({ ref: "DynamicSecretEnginesResponse" });

export const dynamicSecretLeaseResponseSchema = z
	.object({
		id: z.string().openapi({ example: "lease_123" }),
		engine_id: z.string().openapi({ example: "engine_123" }),
		app_id: z.string().openapi({ example: "app_123" }),
		env_type_id: z.string().openapi({ example: "env_type_123" }),
		variable_key: z.string().openapi({ example: "DATABASE_URL" }),
		credential_data: z.record(z.unknown()).openapi({ example: { username: "user_abc", password: "pass_xyz" } }),
		expires_at: z.string().openapi({ example: "2024-01-01T01:00:00Z" }),
		revoked_at: z.string().nullable().openapi({ example: null }),
		created_at: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
		updated_at: z.string().openapi({ example: "2024-01-01T00:00:00Z" }),
	})
	.openapi({ ref: "DynamicSecretLeaseResponse" });

export const dynamicSecretLeasesResponseSchema = z
	.array(dynamicSecretLeaseResponseSchema)
	.openapi({ ref: "DynamicSecretLeasesResponse" });

export const revokeLeaseResponseSchema = z
	.object({
		message: z.string().openapi({ example: "Lease revoked successfully" }),
		id: z.string().openapi({ example: "lease_123" }),
	})
	.openapi({ ref: "RevokeLeaseResponse" });

export const cleanupResponseSchema = z
	.object({
		cleaned: z.number().int().openapi({ example: 5 }),
	})
	.openapi({ ref: "CleanupResponse" });

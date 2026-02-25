import { z } from "zod";

import { loadRootEnv } from "./load-root-env";

loadRootEnv();

export const env = z.object({
	NODE_ENV: z.enum(["development", "production"]).default("development"),
	PORT: z.string(),
	// S3 configuration
	S3_BUCKET: z.string(),
	S3_REGION: z.string(),
	S3_ACCESS_KEY: z.string(),
	S3_SECRET_KEY: z.string(),
	S3_BUCKET_URL: z.string(),
	S3_ENDPOINT: z.string(),
	// Redis configuration
	CACHE_ENV: z.string().optional(),
	REDIS_URL: z.string().optional(),
	// SMTP configuration
	SMTP_HOST: z.string(),
	SMTP_PORT: z.string().default("587"),
	SMTP_SECURE: z.string().default("false"),
	SMTP_USER: z.string().optional(),
	SMTP_PASS: z.string().optional(),
	SMTP_FROM: z.string(),
	// Keycloak configuration
	KEYCLOAK_URL: z.string(),
	KEYCLOAK_REALM: z.string().default("envsync"),
	KEYCLOAK_ADMIN_USER: z.string(),
	KEYCLOAK_ADMIN_PASSWORD: z.string(),
	KEYCLOAK_WEB_CLIENT_ID: z.string(),
	KEYCLOAK_WEB_CLIENT_SECRET: z.string(),
	KEYCLOAK_CLI_CLIENT_ID: z.string(),
	KEYCLOAK_API_CLIENT_ID: z.string(),
	KEYCLOAK_API_CLIENT_SECRET: z.string(),
	KEYCLOAK_WEB_REDIRECT_URI: z.string(),
	KEYCLOAK_WEB_CALLBACK_URL: z.string(),
	KEYCLOAK_API_REDIRECT_URI: z.string(),
	// Landing page configuration
	LANDING_PAGE_URL: z.string(),
	DASHBOARD_URL: z.string().default("http://localhost:8080"),
	// SpaceTimeDB configuration
	STDB_URL: z.string().default("http://localhost:3000"),
	STDB_DB_NAME: z.string().default("envsync-kms"),
	STDB_AUTH_TOKEN: z.string().optional(),
	STDB_ROOT_KEY: z.string(),
	STDB_TOKEN_URL: z.string().optional(),
	STDB_TOKEN_CLIENT_ID: z.string().optional(),
	STDB_TOKEN_CLIENT_SECRET: z.string().optional(),
	// OpenTelemetry configuration
	OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://localhost:4318"),
	OTEL_SERVICE_NAME: z.string().default("envsync-api"),
	OTEL_SDK_DISABLED: z.string().default("false"),
});

export type Env = z.infer<typeof env>;

/**
 * Get parsed the environment variables
 */
export const config = env.parse(process.env);

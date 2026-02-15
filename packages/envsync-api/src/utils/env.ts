import { z } from "zod";

import { loadRootEnv } from "./load-root-env";

loadRootEnv();

export const env = z.object({
	NODE_ENV: z.enum(["development", "production"]).default("development"),
	PORT: z.string(),
	DB_LOGGING: z.string().default("false"),
	DB_AUTO_MIGRATE: z.string().default("false"),
	DATABASE_SSL: z.string().default("false"),
	// Database configuration
	DATABASE_HOST: z.string(),
	DATABASE_PORT: z.string(),
	DATABASE_USER: z.string(),
	DATABASE_PASSWORD: z.string(),
	DATABASE_NAME: z.string(),
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
	// Zitadel configuration
	ZITADEL_URL: z.string(),
	ZITADEL_PAT: z.string().optional(),
	ZITADEL_WEB_CLIENT_ID: z.string(),
	ZITADEL_WEB_CLIENT_SECRET: z.string(),
	ZITADEL_CLI_CLIENT_ID: z.string(),
	ZITADEL_CLI_CLIENT_SECRET: z.string(),
	ZITADEL_API_CLIENT_ID: z.string(),
	ZITADEL_API_CLIENT_SECRET: z.string(),
	ZITADEL_WEB_REDIRECT_URI: z.string(),
	ZITADEL_WEB_CALLBACK_URL: z.string(),
	ZITADEL_API_REDIRECT_URI: z.string(),
	// Landing page configuration
	LANDING_PAGE_URL: z.string(),
	DASHBOARD_URL: z.string().default("http://localhost:8080"),
	// Vault configuration
	VAULT_ADDR: z.string().default("http://127.0.0.1:8200"),
	VAULT_ROLE_ID: z.string(),
	VAULT_SECRET_ID: z.string(),
	VAULT_MOUNT_PATH: z.string().default("envsync"),
	VAULT_NAMESPACE: z.string().optional(),
	// OpenFGA configuration
	OPENFGA_API_URL: z.string().default("http://localhost:8090"),
	OPENFGA_STORE_ID: z.string().optional(),
	OPENFGA_MODEL_ID: z.string().optional(),
});

export type Env = z.infer<typeof env>;

/**
 * Get parsed the environment variables
 */
export const config = env.parse(process.env);

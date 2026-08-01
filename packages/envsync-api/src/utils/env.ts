import { z, type ZodObject, type ZodRawShape } from "zod";

import { collectEnvSchemaExtensions } from "@/modules/load-modules";

import { loadRootEnv } from "./load-root-env";

loadRootEnv();

export const BaseEnvSchema = z.object({
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
	// Keycloak configuration
	KEYCLOAK_URL: z.string(),
	KEYCLOAK_PUBLIC_URL: z.string().optional(),
	KEYCLOAK_REALM: z.string().default("envsync"),
	KEYCLOAK_ADMIN_USER: z.string(),
	KEYCLOAK_ADMIN_PASSWORD: z.string(),
	KEYCLOAK_WEB_CLIENT_ID: z.string(),
	KEYCLOAK_WEB_CLIENT_SECRET: z.string(),
	KEYCLOAK_CLI_CLIENT_ID: z.string(),
	KEYCLOAK_API_CLIENT_ID: z.string(),
	KEYCLOAK_API_CLIENT_SECRET: z.string(),
	KEYCLOAK_ACCESS_TOKEN_LIFESPAN_SECONDS: z.string().default("3600"),
	KEYCLOAK_SSO_SESSION_IDLE_TIMEOUT_SECONDS: z.string().default("604800"),
	KEYCLOAK_SSO_SESSION_MAX_LIFESPAN_SECONDS: z.string().default("604800"),
	KEYCLOAK_CLIENT_SESSION_IDLE_TIMEOUT_SECONDS: z.string().default("604800"),
	KEYCLOAK_CLIENT_SESSION_MAX_LIFESPAN_SECONDS: z.string().default("604800"),
	KEYCLOAK_E2E_CLIENT_ID: z.string().optional(),
	KEYCLOAK_E2E_CLIENT_SECRET: z.string().optional(),
	KEYCLOAK_WEB_REDIRECT_URI: z.string(),
	KEYCLOAK_WEB_CALLBACK_URL: z.string(),
	KEYCLOAK_API_REDIRECT_URI: z.string(),
	// Landing page configuration
	LANDING_PAGE_URL: z.string(),
	DASHBOARD_URL: z.string().default("http://localhost:8080"),
	MANAGEMENT_API_URL: z.string().default("http://localhost:4001"),
	MANAGEMENT_DASHBOARD_URL: z.string().default("http://localhost:8003"),
	MANAGEMENT_API_PORT: z.string().default("4001"),
	// Default enterprise favors Hosted/local EE dev. Self-host OSS must set oss explicitly.
	ENVSYNC_EDITION: z.enum(["oss", "enterprise"]).default("enterprise"),
	// Optional: when unset, EditionPolicyService maps OSS→selfhosted, enterprise→hosted.
	// Self-host enterprise installs MUST set selfhosted (see CONTRIBUTING footguns).
	ENVSYNC_DEPLOYMENT_MODE: z.enum(["hosted", "selfhosted"]).optional(),
	// Phase 7: max_orgs comes from entitlement claims. ENVSYNC_MAX_ORGS is ignored unless
	// ENVSYNC_MAX_ORGS_SUPPORT_OVERRIDE=true (stranded multi-org support installs only).
	ENVSYNC_MAX_ORGS: z.string().optional(),
	ENVSYNC_MAX_ORGS_SUPPORT_OVERRIDE: z.string().optional(),
	// Operator setup token for self-host org create (Phase 1b). Not an end-user session.
	ENVSYNC_SETUP_TOKEN: z.string().optional(),
	ENVSYNC_OBSERVABILITY_ENABLED: z.string().default("true"),
	ENVSYNC_MANAGEMENT_ENABLED: z.string().optional(),
	ENVSYNC_SINGLE_ORG_MODE: z.string().default("false"),
	ENVSYNC_LANDING_ENABLED: z.string().optional(),
	ENVSYNC_MANAGEMENT_WEB_ENABLED: z.string().optional(),
	ENVSYNC_LICENSE_ENFORCEMENT: z.string().default("false"),
	ENVSYNC_LICENSE_MODE: z.enum(["none", "lease", "certificate", "entitlement"]).default("certificate"),
	ENVSYNC_LICENSE_BUNDLE_PATH: z.string().optional(),
	ENVSYNC_LICENSE_CERT_PATH: z.string().optional(),
	ENVSYNC_LICENSE_KEY_PATH: z.string().optional(),
	ENVSYNC_LICENSE_ROOT_CA_CERT_PATH: z.string().optional(),
	ENVSYNC_LICENSE_ROOT_CA_CERT_PEM: z.string().optional(),
	ENVSYNC_LICENSE_SERVER_URL: z.string().optional(),
	ENVSYNC_LICENSE_KEY: z.string().optional(),
	ENVSYNC_INSTALL_FINGERPRINT: z.string().optional(),
	ENVSYNC_LICENSE_LEASE_TTL_SECONDS: z.string().default("300"),
	// Phase 4 Coder-style entitlement JWT (public key verify only; private key never ships)
	ENVSYNC_ENTITLEMENT_JWT: z.string().optional(),
	ENVSYNC_ENTITLEMENT_JWT_PATH: z.string().optional(),
	ENVSYNC_ENTITLEMENT_GRACE_SECONDS: z.string().optional(),
	ENVSYNC_LICENSE_PUBLIC_KEY_PEM: z.string().optional(),
	ENVSYNC_LICENSE_PUBLIC_KEY_PATH: z.string().optional(),
	ENVSYNC_STACK_NAME: z.string().optional(),
	ENVSYNC_RELEASE_VERSION: z.string().optional(),
	// OpenFGA configuration
	OPENFGA_API_URL: z.string().default("http://localhost:8090"),
	OPENFGA_STORE_ID: z.string().optional(),
	OPENFGA_MODEL_ID: z.string().optional(),
	// miniKMS configuration
	MINIKMS_GRPC_ADDR: z.string().default("localhost:50051"),
	MINIKMS_TLS_ENABLED: z.string().default("false"),
	MINIKMS_TLS_CA_CERT: z.string().optional(),
	// OpenTelemetry configuration
	OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default("http://localhost:14318"),
	OTEL_SERVICE_NAME: z.string().default("envsync-api"),
	OTEL_SDK_DISABLED: z.string().default("false"),
	// SAML SSO configuration (optional — derived from Keycloak config if absent)
	SAML_SESSION_SECRET: z.string().optional(),
	SAML_SP_CERT: z.string().optional(),
	SAML_SP_KEY: z.string().optional(),
});

export function composeEnvSchema(extensions: ZodRawShape[] = []): ZodObject<ZodRawShape> {
	const mergedShape: ZodRawShape = {
		...BaseEnvSchema.shape,
	};

	for (const extension of extensions) {
		Object.assign(mergedShape, extension);
	}

	return z.object(mergedShape);
}

export const env = composeEnvSchema(collectEnvSchemaExtensions());

export type Env = z.infer<typeof env>;

/**
 * Get parsed the environment variables
 */
export const config = env.parse(process.env);

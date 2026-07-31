import z from "zod";

const runtimeConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  appBaseUrl: z.string().url(),
  authBaseUrl: z.string().url(),
  managementApiUrl: z.string().url().optional(),
  keycloakRealm: z.string().min(1),
  webClientId: z.string().min(1),
  apiDocsUrl: z.string().url(),
  edition: z.enum(["oss", "enterprise"]).default("enterprise"),
  dashboardVariant: z.enum(["oss", "enterprise"]).default("enterprise"),
  managementEnabled: z.boolean().default(false),
  /** Hosted multi-tenant SaaS vs self-hosted product install (program plan Phase 1). */
  deploymentMode: z.enum(["hosted", "selfhosted"]).optional(),
  /** Dashboard may create organizations only on hosted. */
  canCreateOrganization: z.boolean().optional(),
  publicSignupEnabled: z.boolean().optional(),
  maxOrgs: z.number().nullable().optional(),
  licenseStatus: z.enum(["unknown", "active", "inactive", "expired", "error", "locked"]).optional(),
  licenseLocked: z.boolean().optional(),
  otelEndpoint: z.string().url().optional(),
  hyperdxApiKey: z.string().min(1).optional(),
  hyperdxUrl: z.string().url().optional(),
  hyperdxDisabled: z.boolean().optional(),
  hyperdxAdvancedNetworkCapture: z.boolean().optional(),
  releaseVersion: z.string().min(1).optional(),
  activeApiSlot: z.enum(["blue", "green"]).optional(),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

declare global {
  interface Window {
    __ENVSYNC_RUNTIME_CONFIG__?: unknown;
  }
}

const defaultApiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const buildEdition = import.meta.env.VITE_SERVER_LICENSE === "oss"
  ? "oss"
  : import.meta.env.VITE_SERVER_LICENSE === "enterprise"
    ? "enterprise"
    : import.meta.env.VITE_ENVSYNC_DASHBOARD_VARIANT === "oss"
      ? "oss"
      : "enterprise";

function inferFallbackRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") {
    return {
      apiBaseUrl: defaultApiBaseUrl,
      appBaseUrl: "http://app.lvh.me:8001",
      authBaseUrl: "http://auth.lvh.me:8080",
      managementApiUrl: import.meta.env.VITE_MANAGEMENT_API_URL || "http://manage-api.lvh.me:4001",
      keycloakRealm: "envsync",
      webClientId: "envsync-web",
      apiDocsUrl: `${defaultApiBaseUrl.replace(/\/$/, "")}/docs`,
      edition: buildEdition,
      dashboardVariant: buildEdition,
      managementEnabled: import.meta.env.VITE_ENVSYNC_MANAGEMENT_ENABLED === "true" || buildEdition === "enterprise",
      licenseStatus: undefined,
      licenseLocked: false,
      otelEndpoint: "http://localhost:4318",
      hyperdxApiKey: import.meta.env.VITE_HYPERDX_API_KEY || undefined,
      hyperdxUrl: import.meta.env.VITE_HYPERDX_URL || undefined,
      hyperdxDisabled: import.meta.env.VITE_HYPERDX_DISABLED === "true",
      hyperdxAdvancedNetworkCapture: false,
    };
  }

  const { protocol, hostname, port, origin } = window.location;
  const host = port ? `${hostname}:${port}` : hostname;
  const rootHost =
    host.startsWith("app.") ? host.slice(4) :
    host.startsWith("api.") ? host.slice(4) :
    host.startsWith("auth.") ? host.slice(5) :
    host.startsWith("obs.") ? host.slice(4) :
    host;

  const apiBaseUrl = `${protocol}//api.${rootHost}`;
  return {
    apiBaseUrl,
    appBaseUrl: host.startsWith("app.") ? origin : `${protocol}//app.${rootHost}`,
    authBaseUrl: `${protocol}//auth.${rootHost}`,
    managementApiUrl: import.meta.env.VITE_MANAGEMENT_API_URL || `${protocol}//manage-api.${rootHost}`,
    keycloakRealm: "envsync",
    webClientId: "envsync-web",
    apiDocsUrl: `${apiBaseUrl}/docs`,
    edition: buildEdition,
    dashboardVariant: buildEdition,
    managementEnabled: import.meta.env.VITE_ENVSYNC_MANAGEMENT_ENABLED === "true" || buildEdition === "enterprise",
    licenseStatus: undefined,
    licenseLocked: false,
    otelEndpoint: `${protocol}//obs.${rootHost}`,
    hyperdxApiKey: import.meta.env.VITE_HYPERDX_API_KEY || undefined,
    hyperdxUrl: import.meta.env.VITE_HYPERDX_URL || `${protocol}//obs.${rootHost}`,
    hyperdxDisabled: import.meta.env.VITE_HYPERDX_DISABLED === "true",
    hyperdxAdvancedNetworkCapture: false,
  };
}

const fallbackRuntimeConfig: RuntimeConfig = inferFallbackRuntimeConfig();

function getRuntimeConfig(): RuntimeConfig {
  try {
    return runtimeConfigSchema.parse(
      typeof window !== "undefined" ? window.__ENVSYNC_RUNTIME_CONFIG__ : undefined
    );
  } catch (error) {
    console.warn("Runtime config validation failed, using defaults:", error);
    return fallbackRuntimeConfig;
  }
}

export const runtimeConfig = getRuntimeConfig();
export const isEnterpriseDashboard = runtimeConfig.dashboardVariant === "enterprise";

/** Hosted-only: dashboard "Create organization". Self-host never shows this (program plan §1.1a). */
export function canCreateOrganizationInUi(config: RuntimeConfig = runtimeConfig): boolean {
  if (typeof config.canCreateOrganization === "boolean") {
    return config.canCreateOrganization;
  }
  // Fallback until runtime-config.js is updated by deploy: treat selfhosted edition builds as no.
  if (config.deploymentMode === "selfhosted") {
    return false;
  }
  if (config.deploymentMode === "hosted") {
    return true;
  }
  // Legacy: enterprise build without deploymentMode — assume hosted-like (local).
  return config.edition === "enterprise";
}

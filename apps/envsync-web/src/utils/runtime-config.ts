import z from "zod";

import { firstPartyOtelUrl } from "./first-party-otel";

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
  posthogKey: z.string().min(1).optional(),
  posthogHost: z.string().url().optional(),
  posthogDisabled: z.boolean().optional(),
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
/** Unified manage surface on the core API process (no separate manage-api host). */
const MANAGE_API_PATH = "/api/v1/manage";
const buildEdition = import.meta.env.VITE_SERVER_LICENSE === "oss"
  ? "oss"
  : import.meta.env.VITE_SERVER_LICENSE === "enterprise"
    ? "enterprise"
    : import.meta.env.VITE_ENVSYNC_DASHBOARD_VARIANT === "oss"
      ? "oss"
      : "enterprise";

function defaultManagementApiUrl(apiBaseUrl: string): string {
  if (import.meta.env.VITE_MANAGEMENT_API_URL) {
    return import.meta.env.VITE_MANAGEMENT_API_URL;
  }
  return `${apiBaseUrl.replace(/\/$/, "")}${MANAGE_API_PATH}`;
}

function inferFallbackRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") {
    return {
      apiBaseUrl: defaultApiBaseUrl,
      appBaseUrl: "http://app.lvh.me:8001",
      authBaseUrl: "http://auth.lvh.me:8080",
      managementApiUrl: defaultManagementApiUrl(defaultApiBaseUrl),
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
      posthogKey: import.meta.env.VITE_POSTHOG_KEY || undefined,
      posthogHost: import.meta.env.VITE_POSTHOG_HOST || undefined,
      posthogDisabled: import.meta.env.VITE_POSTHOG_DISABLED === "true",
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
    managementApiUrl: defaultManagementApiUrl(apiBaseUrl),
    keycloakRealm: "envsync",
    webClientId: "envsync-web",
    apiDocsUrl: `${apiBaseUrl}/docs`,
    edition: buildEdition,
    dashboardVariant: buildEdition,
    managementEnabled: import.meta.env.VITE_ENVSYNC_MANAGEMENT_ENABLED === "true" || buildEdition === "enterprise",
    licenseStatus: undefined,
    licenseLocked: false,
    otelEndpoint: firstPartyOtelUrl(import.meta.env.VITE_OTEL_ENDPOINT) || `${protocol}//t.${rootHost}/obs`,
    hyperdxApiKey: import.meta.env.VITE_HYPERDX_API_KEY || undefined,
    hyperdxUrl: firstPartyOtelUrl(import.meta.env.VITE_HYPERDX_URL) || `${protocol}//t.${rootHost}/obs`,
    hyperdxDisabled: import.meta.env.VITE_HYPERDX_DISABLED === "true",
    hyperdxAdvancedNetworkCapture: false,
    posthogKey: import.meta.env.VITE_POSTHOG_KEY || undefined,
    posthogHost: import.meta.env.VITE_POSTHOG_HOST || `${protocol}//t.${rootHost}/ph`,
    posthogDisabled: import.meta.env.VITE_POSTHOG_DISABLED === "true",
  };
}

const fallbackRuntimeConfig: RuntimeConfig = inferFallbackRuntimeConfig();

function isLocalDevHost(hostname: string): boolean {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname.endsWith(".lvh.me")
    || hostname.endsWith(".local");
}

function isLocalDevUrl(url: string): boolean {
  try {
    return isLocalDevHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

function getRuntimeConfig(): RuntimeConfig {
  try {
    const parsed = runtimeConfigSchema.parse(
      typeof window !== "undefined" ? window.__ENVSYNC_RUNTIME_CONFIG__ : undefined,
    );
    const onLocalPage = typeof window !== "undefined" && isLocalDevHost(window.location.hostname);
    if (!onLocalPage && isLocalDevUrl(parsed.apiBaseUrl)) {
      return inferFallbackRuntimeConfig();
    }
    return {
      ...parsed,
      otelEndpoint: firstPartyOtelUrl(parsed.otelEndpoint) ?? parsed.otelEndpoint,
      hyperdxUrl: firstPartyOtelUrl(parsed.hyperdxUrl) ?? parsed.hyperdxUrl,
    };
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
  return false;
}

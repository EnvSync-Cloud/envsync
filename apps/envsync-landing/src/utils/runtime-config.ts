import z from "zod";

import { firstPartyOtelUrl } from "./first-party-otel";

const runtimeConfigSchema = z.object({
  apiBaseUrl: z.string().url(),
  appBaseUrl: z.string().url(),
  authBaseUrl: z.string().url(),
  keycloakRealm: z.string().min(1),
  webClientId: z.string().min(1),
  apiDocsUrl: z.string().url(),
  otelEndpoint: z.string().url().optional(),
  hyperdxApiKey: z.string().min(1).optional(),
  hyperdxUrl: z.string().url().optional(),
  hyperdxDisabled: z.boolean().optional(),
  hyperdxAdvancedNetworkCapture: z.boolean().optional(),
  posthogKey: z.string().min(1).optional(),
  posthogHost: z.string().url().optional(),
  posthogDisabled: z.boolean().optional(),
  releaseVersion: z.string().min(1).optional(),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

declare global {
  interface Window {
    __ENVSYNC_RUNTIME_CONFIG__?: unknown;
  }
}

const defaultApiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function inferFallbackRuntimeConfig(): RuntimeConfig {
  if (typeof window === "undefined") {
    return {
      apiBaseUrl: defaultApiBaseUrl,
      appBaseUrl: "http://app.lvh.me:8001",
      authBaseUrl: "http://auth.lvh.me:8080",
      keycloakRealm: "envsync",
      webClientId: "envsync-web",
      apiDocsUrl: `${defaultApiBaseUrl.replace(/\/$/, "")}/docs`,
      otelEndpoint: "http://localhost:14318",
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
    keycloakRealm: "envsync",
    webClientId: "envsync-web",
    apiDocsUrl: `${apiBaseUrl}/docs`,
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

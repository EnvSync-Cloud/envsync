import { firstPartyOtelUrl } from "@/utils/first-party-otel";
import { runtimeConfig } from "@/utils/runtime-config";

export interface TelemetryConfig {
  endpoint: string;
  serviceName: string;
  disabled: boolean;
  sampleRate: number;
  apiKey: string;
  surface: "landing";
}

export function getTelemetryConfig(): TelemetryConfig {
  const disabled = runtimeConfig.hyperdxDisabled ?? (import.meta.env.VITE_OTEL_SDK_DISABLED === "true");
  return {
    endpoint:
      firstPartyOtelUrl(runtimeConfig.hyperdxUrl) ||
      firstPartyOtelUrl(runtimeConfig.otelEndpoint) ||
      firstPartyOtelUrl(import.meta.env.VITE_OTEL_ENDPOINT) ||
      "http://localhost:14318",
    serviceName: import.meta.env.VITE_OTEL_SERVICE_NAME || "envsync-landing",
    disabled,
    sampleRate: parseFloat(import.meta.env.VITE_OTEL_TRACE_SAMPLE_RATE || "1.0"),
    apiKey: runtimeConfig.hyperdxApiKey || import.meta.env.VITE_HYPERDX_API_KEY || "",
    surface: "landing",
  };
}

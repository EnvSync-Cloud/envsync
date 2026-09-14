import { runtimeConfig } from "@/utils/runtime-config";

export interface TelemetryConfig {
  endpoint: string;
  serviceName: string;
  disabled: boolean;
  sampleRate: number;
  apiKey: string;
  surface: "dashboard";
}

export function getTelemetryConfig(): TelemetryConfig {
  const disabled = runtimeConfig.hyperdxDisabled ?? (import.meta.env.VITE_OTEL_SDK_DISABLED === "true");
  return {
    endpoint:
      runtimeConfig.otelEndpoint ||
      runtimeConfig.hyperdxUrl ||
      import.meta.env.VITE_OTEL_ENDPOINT ||
      import.meta.env.VITE_HYPERDX_URL ||
      "http://localhost:4318",
    serviceName: import.meta.env.VITE_OTEL_SERVICE_NAME || "envsync-web",
    disabled,
    sampleRate: parseFloat(import.meta.env.VITE_OTEL_TRACE_SAMPLE_RATE || "1.0"),
    apiKey: runtimeConfig.hyperdxApiKey || import.meta.env.VITE_HYPERDX_API_KEY || "",
    surface: "dashboard",
  };
}

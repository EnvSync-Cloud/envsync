export interface TelemetryConfig {
  endpoint: string;
  serviceName: string;
  disabled: boolean;
  sampleRate: number;
}

export function getTelemetryConfig(): TelemetryConfig {
  return {
    endpoint: import.meta.env.VITE_OTEL_ENDPOINT || "http://localhost:4318",
    serviceName: import.meta.env.VITE_OTEL_SERVICE_NAME || "envsync-web",
    disabled: import.meta.env.VITE_OTEL_SDK_DISABLED === "true",
    sampleRate: parseFloat(import.meta.env.VITE_OTEL_TRACE_SAMPLE_RATE || "1.0"),
  };
}

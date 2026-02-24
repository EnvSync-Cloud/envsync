/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_OTEL_ENDPOINT: string;
  readonly VITE_OTEL_SERVICE_NAME: string;
  readonly VITE_OTEL_SDK_DISABLED: string;
  readonly VITE_OTEL_TRACE_SAMPLE_RATE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

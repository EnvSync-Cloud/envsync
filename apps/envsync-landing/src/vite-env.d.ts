/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_OTEL_ENDPOINT: string;
  readonly VITE_OTEL_SERVICE_NAME: string;
  readonly VITE_OTEL_SDK_DISABLED: string;
  readonly VITE_OTEL_TRACE_SAMPLE_RATE: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_HYPERDX_API_KEY: string;
  readonly VITE_HYPERDX_URL: string;
  readonly VITE_HYPERDX_DISABLED: string;
  readonly VITE_HYPERDX_ADVANCED_NETWORK_CAPTURE: string;
  readonly VITE_POSTHOG_KEY: string;
  readonly VITE_POSTHOG_PROJECT_TOKEN: string;
  readonly VITE_POSTHOG_HOST: string;
  readonly VITE_POSTHOG_UI_HOST: string;
  readonly VITE_POSTHOG_DISABLED: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

import HyperDX from "@hyperdx/browser";
import { runtimeConfig } from "@/utils/runtime-config";
import { capturePostHogEvent } from "./posthog";

let hdxActive = false;

type SearchableValue = string | number | boolean | null | undefined;

function normalizeActionAttributes(attributes: Record<string, SearchableValue>) {
  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined),
  );
}

export function initSessionReplay(): void {
  const apiKey = runtimeConfig.hyperdxApiKey || import.meta.env.VITE_HYPERDX_API_KEY;
  const url = runtimeConfig.hyperdxUrl || runtimeConfig.otelEndpoint || import.meta.env.VITE_HYPERDX_URL;
  const disabled = runtimeConfig.hyperdxDisabled ?? (import.meta.env.VITE_HYPERDX_DISABLED === "true");
  const apiBaseUrl = runtimeConfig.apiBaseUrl;
  if (!apiKey || !url || disabled) return;

  HyperDX.init({
    apiKey,
    service: "envsync-landing",
    url,
    consoleCapture: true,
    advancedNetworkCapture:
      runtimeConfig.hyperdxAdvancedNetworkCapture === true ||
      import.meta.env.VITE_HYPERDX_ADVANCED_NETWORK_CAPTURE === "true",
    maskAllInputs: true,
    maskClass: "hdx-mask",
    blockClass: "hdx-block",
    tracePropagationTargets: [new RegExp(apiBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))],
    otelResourceAttributes: {
      "deployment.environment": import.meta.env.MODE || "production",
      "service.version": runtimeConfig.releaseVersion || "unknown",
    },
  });
  hdxActive = true;
}

export function trackAction(name: string, attributes: Record<string, SearchableValue> = {}): void {
  capturePostHogEvent(name, attributes);
  if (!hdxActive) return;
  HyperDX.addAction(name, normalizeActionAttributes(attributes));
}

import HyperDX from "@hyperdx/browser";
import { runtimeConfig } from "@/utils/runtime-config";
import { capturePostHogEvent, identifyPostHogUser } from "./posthog";

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
    service: "envsync-web",
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

/** True when HyperDX is active (it bundles its own OTel provider). */
export function isHyperDXActive(): boolean {
  return hdxActive;
}

export function identifyUser(
  userId: string,
  metadata?: Record<string, string | undefined>,
): void {
  identifyPostHogUser(userId, metadata);
  if (!hdxActive) return;
  HyperDX.setGlobalAttributes({
    userId,
    userName: metadata?.name,
    "envsync.user_id": userId,
    "envsync.org_id": metadata?.orgId,
    "envsync.role_name": metadata?.roleName,
  });
}

export function trackAction(name: string, attributes: Record<string, SearchableValue> = {}): void {
  capturePostHogEvent(name, attributes);
  if (!hdxActive) return;
  HyperDX.addAction(name, normalizeActionAttributes(attributes));
}

import posthog from "posthog-js";
import { POSTHOG_BROWSER_INIT, rewritePosthogRequestUrl } from "envsync-analytics";

import { runtimeConfig } from "@/utils/runtime-config";

let active = false;

export function initPostHog(): void {
  const key =
    runtimeConfig.posthogKey ||
    import.meta.env.VITE_POSTHOG_KEY ||
    import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
  const host = runtimeConfig.posthogHost || import.meta.env.VITE_POSTHOG_HOST || "https://t.envsync.cloud/ph";
  const disabled = runtimeConfig.posthogDisabled ?? import.meta.env.VITE_POSTHOG_DISABLED === "true";
  if (!key || disabled || active) return;

  posthog.init(key, {
    api_host: host,
    ui_host: import.meta.env.VITE_POSTHOG_UI_HOST || "https://eu.posthog.com",
    rewriteRequestPath: rewritePosthogRequestUrl,
    ...POSTHOG_BROWSER_INIT,
    disable_session_recording: true,
  });
  posthog.register({
    release_version: runtimeConfig.releaseVersion || "unknown",
    product: "envsync-landing",
  });
  active = true;
}

export function isPostHogActive(): boolean {
  return active;
}

export function capturePostHogEvent(name: string, properties: Record<string, string | number | boolean | null | undefined> = {}): void {
  if (!active) return;
  const cleaned = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );
  posthog.capture(name, cleaned);
}

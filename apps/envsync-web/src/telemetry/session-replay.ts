import HyperDX from "@hyperdx/browser";

let hdxActive = false;

export function initSessionReplay(): void {
  const apiKey = import.meta.env.VITE_HYPERDX_API_KEY;
  const url = import.meta.env.VITE_HYPERDX_URL;
  const disabled = import.meta.env.VITE_HYPERDX_DISABLED === "true";
  if (!apiKey || disabled) return;

  HyperDX.init({
    apiKey,
    service: "envsync-web",
    url,
    consoleCapture: true,
    advancedNetworkCapture: false,
    maskAllInputs: true,
    maskClass: "hdx-mask",
    blockClass: "hdx-block",
    tracePropagationTargets: [/localhost:4000/],
  });
  hdxActive = true;
}

/** True when HyperDX is active (it bundles its own OTel provider). */
export function isHyperDXActive(): boolean {
  return hdxActive;
}

export function identifyUser(
  userId: string,
  metadata?: Record<string, string>,
): void {
  HyperDX.setGlobalAttributes({
    userId,
    userEmail: metadata?.email,
    teamName: metadata?.org,
  });
}

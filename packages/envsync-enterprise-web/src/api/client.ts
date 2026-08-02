import { EnvSyncAPISDK } from "@envsync-cloud/envsync-ts-sdk";
import { runtimeConfig } from "@shell/utils/runtime-config";

let apiSdk: EnvSyncAPISDK | null = null;

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function isUnsafeMethod(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

export function isEnterpriseUiEnabled() {
  // Manage routes live on the core API process under /api/v1/manage/...
  return (
    runtimeConfig.managementEnabled === true || runtimeConfig.edition === "enterprise"
  );
}

export function enterpriseErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const apiError = error as {
      body?: { error?: string };
      message?: string;
      statusText?: string;
    };
    return String(apiError.body?.error || apiError.message || apiError.statusText || "Enterprise request failed");
  }

  return "Enterprise request failed";
}

/**
 * Same origin as product API. Manage operations use paths under /api/v1/manage/...
 * (generated into EnvSyncAPISDK).
 */
export function getEnterpriseSDK(): EnvSyncAPISDK {
  if (!apiSdk) {
    const resolveHeaders = async (options: { method: string }) => {
      if (!isUnsafeMethod(options.method)) return {};
      const csrfToken = readCookie("envsync_csrf");
      return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
    };

    apiSdk = new EnvSyncAPISDK({
      BASE: runtimeConfig.apiBaseUrl,
      WITH_CREDENTIALS: true,
      CREDENTIALS: "include",
      HEADERS: resolveHeaders,
    });
  }
  return apiSdk;
}

/** @deprecated Prefer getEnterpriseSDK — same client after SDK merge. */
export function getManagementSDK(): Promise<EnvSyncAPISDK> {
  return Promise.resolve(getEnterpriseSDK());
}

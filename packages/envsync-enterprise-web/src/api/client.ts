import { runtimeConfig } from "@shell/utils/runtime-config";

let managementSdkPromise: Promise<import("@envsync-cloud/envsync-management-ts-sdk").EnvSyncManagementAPISDK> | null = null;

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
  return runtimeConfig.edition === "enterprise" && Boolean(runtimeConfig.managementApiUrl);
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

export async function getManagementSDK() {
  if (!runtimeConfig.managementApiUrl) {
    throw new Error("Management API URL is not configured.");
  }

  if (!managementSdkPromise) {
    managementSdkPromise = import("@envsync-cloud/envsync-management-ts-sdk").then(({ EnvSyncManagementAPISDK }) => {
      const resolveHeaders = async (options: { method: string }) => {
        if (!isUnsafeMethod(options.method)) return {};
        const csrfToken = readCookie("envsync_csrf");
        return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
      };

      return new EnvSyncManagementAPISDK({
        BASE: runtimeConfig.managementApiUrl!,
        WITH_CREDENTIALS: true,
        CREDENTIALS: "include",
        HEADERS: resolveHeaders,
      });
    });
  }

  return managementSdkPromise;
}

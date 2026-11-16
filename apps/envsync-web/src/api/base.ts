import { EnvSyncAPISDK } from "@envsync-cloud/envsync-ts-sdk";
import { deleteDeviceKey, resourceProofHeaders } from "@/lib/dpop-session";
import { isPublicAuthPath } from "@/lib/login-auth";
import { env, type Function } from "@/utils/env";
import { runtimeConfig } from "@/utils/runtime-config";

export { isPublicAuthPath };

let loginRedirectInFlight = false;

const CSRF_COOKIE = "envsync_csrf";

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

const RELOGIN_CODES = ["AUTH_MISSING", "AUTH_INVALID", "AUTH_RELOGIN_REQUIRED"];

function isReloginCode(code: unknown) {
  const value = String(code ?? "");
  return value.startsWith("DPOP_") || RELOGIN_CODES.includes(value);
}

export function isReloginError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.status === 401 && isReloginCode(error.code);
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: unknown }).status === 401 &&
    "body" in error
  ) {
    const body = (error as { body: unknown }).body;
    if (typeof body === "object" && body !== null && "code" in body) {
      return isReloginCode((body as { code: unknown }).code);
    }
  }

  return false;
}

function readErrorCode(error: unknown) {
  if (error instanceof ApiRequestError) return String(error.code ?? "");
  if (typeof error === "object" && error !== null && "body" in error) {
    const body = (error as { body: unknown }).body;
    if (typeof body === "object" && body !== null && "code" in body) {
      return String((body as { code: unknown }).code ?? "");
    }
  }
  return "";
}

export async function redirectToLogin(error?: unknown) {
  if (readErrorCode(error) === "DPOP_REVOKED") {
    await deleteDeviceKey().catch(() => undefined);
  }
  if (typeof window === "undefined") return;
  if (isPublicAuthPath(window.location.pathname)) return;
  if (loginRedirectInFlight) return;
  loginRedirectInFlight = true;
  window.location.href = "/login";
}

export async function logoutWebSession() {
  const url = `${runtimeConfig.apiBaseUrl}/api/access/web/logout`;
  const headers: Record<string, string> = {
    ...(await resourceProofHeaders("POST", url)),
  };
  const csrfToken = readCookie(CSRF_COOKIE);
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.logoutUrl) {
      throw new Error("Failed to prepare logout");
    }
    await deleteDeviceKey();
    window.location.href = data.logoutUrl;
  } catch (error) {
    await deleteDeviceKey().catch(() => undefined);
    throw error;
  }
}

/**
 *
 * Creates an instance of the EnvSync API SDK.
 * DPoP sessions keep the access token in page memory and send Authorization: DPoP.
 * The refresh token stays in an HttpOnly cookie. SAML sessions still use that cookie.
 */
export const getSDK = () => {
  const resolveHeaders = async (options: { method: string; url: string }) => {
    const headers: Record<string, string> = {};
    if (isUnsafeMethod(options.method)) {
      const csrfToken = readCookie(CSRF_COOKIE);
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    }
    const path = options.url.startsWith("/") ? options.url : `/${options.url}`;
    const session = await resourceProofHeaders(
      options.method,
      `${env.VITE_API_BASE_URL.replace(/\/$/, "")}${path}`,
    );
    return { ...headers, ...session };
  };

  return new EnvSyncAPISDK({
    BASE: env.VITE_API_BASE_URL,
    WITH_CREDENTIALS: true,
    CREDENTIALS: "include",
    HEADERS: resolveHeaders,
  });
};

export const sdk = getSDK();

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  body?: unknown;

  constructor(message: string, status: number, code?: string, body?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = init.method || "GET";
  const headers = new Headers(init.headers || {});

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (isUnsafeMethod(method)) {
    const csrfToken = readCookie(CSRF_COOKIE);
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  const session = await resourceProofHeaders(
    method,
    `${runtimeConfig.apiBaseUrl}${path}`,
  );
  for (const [key, value] of Object.entries(session)) {
    headers.set(key, value);
  }

  const response = await fetch(`${runtimeConfig.apiBaseUrl}${path}`, {
    ...init,
    method,
    credentials: "include",
    headers,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const err = new ApiRequestError(
      String(
        (body as { error?: string } | null)?.error ||
          response.statusText ||
          "Request failed",
      ),
      response.status,
      String((body as { code?: string } | null)?.code || ""),
      body,
    );

    throw err;
  }

  return body as T;
}

export interface MutationOptions<TData = unknown, TVariables = unknown> {
  before?: Function<TVariables>;
  onSuccess?: Function<{ data: TData; variables?: TVariables }>;
  onError?: Function<{ error: Error; variables?: TVariables }>;
}

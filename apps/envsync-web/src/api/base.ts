import { EnvSyncAPISDK } from "@envsync-cloud/envsync-ts-sdk";
import { env, type Function } from "@/utils/env";
import { runtimeConfig } from "@/utils/runtime-config";

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

export function isReloginError(error: unknown) {
  if (error instanceof ApiRequestError) {
    return error.status === 401 && RELOGIN_CODES.includes(String(error.code ?? ""));
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
      return RELOGIN_CODES.includes(String((body as { code: unknown }).code ?? ""));
    }
  }

  return false;
}

export async function redirectToLogin() {
  if (loginRedirectInFlight) return;
  loginRedirectInFlight = true;
  try {
    const response = await getSDK().access.createWebLogin();
    if (response?.loginUrl) {
      window.location.href = response.loginUrl;
      return;
    }
  } catch (error) {
    console.error("Failed to create web login:", error);
  }
  loginRedirectInFlight = false;
}

export async function logoutWebSession() {
  const csrfToken = readCookie(CSRF_COOKIE) ?? "";
  const response = await fetch(`${runtimeConfig.apiBaseUrl}/api/access/web/logout`, {
    method: "POST",
    credentials: "include",
    headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.logoutUrl) {
    throw new Error("Failed to prepare logout");
  }

  window.location.href = data.logoutUrl;
}

/**
 *
 * Creates an instance of the EnvSync API SDK using credentialed browser requests.
 * The API owns the session via secure cookies, so the browser never stores bearer tokens.
 */
export const getSDK = () => {
  const resolveHeaders = async (options: { method: string }) => {
    if (!isUnsafeMethod(options.method)) return {};
    const csrfToken = readCookie(CSRF_COOKIE);
    return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
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

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
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

  const response = await fetch(`${runtimeConfig.apiBaseUrl}${path}`, {
    ...init,
    method,
    credentials: "include",
    headers,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const err = new ApiRequestError(
      String((body as { error?: string } | null)?.error || response.statusText || "Request failed"),
      response.status,
      String((body as { code?: string } | null)?.code || ""),
      body,
    );

    if (isReloginError(err)) {
      void redirectToLogin();
    }

    throw err;
  }

  return body as T;
}

export interface MutationOptions<TData = unknown, TVariables = unknown> {
  before?: Function<TVariables>;
  onSuccess?: Function<{ data: TData; variables?: TVariables }>;
  onError?: Function<{ error: Error; variables?: TVariables }>;
}

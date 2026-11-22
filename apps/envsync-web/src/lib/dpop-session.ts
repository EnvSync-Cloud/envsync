import { p256 } from "@noble/curves/nist.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { runtimeConfig } from "@/utils/runtime-config";
import { createUuid } from "@/utils/uuid";

const DB_NAME = "envsync-dpop";
const STORE = "keys";
const KEY_ID = "session";
const LOGIN_STATE_KEY = "envsync_login_state";
const DPOP_COOKIE = "envsync_dpop";

/** P-256 key kept for http://*.lvh.me, where browsers hide crypto.subtle. */
export type SoftwarePrivateKey = {
  software: "p256";
  d: string;
};

export type DeviceKey = {
  privateKey: CryptoKey | SoftwarePrivateKey;
  publicJwk: JsonWebKey;
};

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}

export function atriumTokenUrl() {
  return `${runtimeConfig.authBaseUrl.replace(/\/$/, "")}/oauth/token`;
}

export function browserDeviceLabel() {
  if (typeof navigator === "undefined") return "Browser";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Mac/.test(ua)
    ? "macOS"
    : /Windows/.test(ua)
      ? "Windows"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return os && browser !== "Browser" ? `${browser} on ${os}` : browser;
}

export function proofUrl(url: string) {
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

/** Fill `{param}` the same way the generated SDK builds the request URL. */
export function resourceRequestUrl(
  base: string,
  url: string,
  path?: Record<string, unknown>,
) {
  const resolved = url.replace(/{(.*?)}/g, (substring, group: string) => {
    if (path && Object.prototype.hasOwnProperty.call(path, group)) {
      return encodeURI(String(path[group]));
    }
    return substring;
  });
  const origin = base.replace(/\/$/, "");
  const relative = resolved.startsWith("/") ? resolved : `/${resolved}`;
  return `${origin}${relative}`;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function jsonToBase64Url(value: unknown) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function tokenStillValid(token: string) {
  try {
    const part = token.split(".")[1];
    if (!part) return false;
    const payload = JSON.parse(
      atob(part.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return (
      typeof payload.exp === "number" &&
      payload.exp * 1000 > Date.now() + 15_000
    );
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open the device key store"));
  });
}

async function idbRequest<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(request.error ?? new Error("Device key store request failed"));
    });
  } finally {
    db.close();
  }
}

export async function loadDeviceKey(): Promise<DeviceKey | null> {
  if (typeof indexedDB === "undefined") return null;
  const record = await idbRequest<DeviceKey | undefined>("readonly", (store) =>
    store.get(KEY_ID),
  );
  if (!record?.privateKey || !record.publicJwk) return null;
  return record;
}

function isSoftwarePrivateKey(key: DeviceKey["privateKey"]): key is SoftwarePrivateKey {
  return typeof key === "object" && key !== null && "software" in key && key.software === "p256";
}

function localInsecureDevHost() {
  if (typeof window === "undefined" || window.isSecureContext) return false;
  const host = window.location.hostname;
  return host === "localhost"
    || host === "127.0.0.1"
    || host.endsWith(".lvh.me")
    || host.endsWith(".localhost");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
    + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function generateSoftwareDeviceKey(): DeviceKey {
  const { secretKey } = p256.keygen();
  const uncompressed = p256.getPublicKey(secretKey, false);
  return {
    privateKey: { software: "p256", d: bytesToBase64Url(secretKey) },
    publicJwk: {
      kty: "EC",
      crv: "P-256",
      x: bytesToBase64Url(uncompressed.slice(1, 33)),
      y: bytesToBase64Url(uncompressed.slice(33, 65)),
    },
  };
}

async function generateWebCryptoDeviceKey(): Promise<DeviceKey> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const exported = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return {
    privateKey: pair.privateKey,
    publicJwk: {
      kty: exported.kty,
      crv: exported.crv,
      x: exported.x,
      y: exported.y,
    },
  };
}

async function sha256Bytes(data: Uint8Array) {
  if (crypto.subtle) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", data as BufferSource));
  }
  return sha256(data);
}

async function signEs256(key: DeviceKey["privateKey"], data: Uint8Array) {
  if (isSoftwarePrivateKey(key)) {
    return p256.sign(data, base64UrlToBytes(key.d), { lowS: true, prehash: true });
  }
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    data as BufferSource,
  );
  return new Uint8Array(signature);
}

export async function ensureDeviceKey(): Promise<DeviceKey> {
  const existing = await loadDeviceKey();
  if (existing) return existing;
  if (typeof indexedDB === "undefined") {
    throw new Error("This browser cannot store a device key.");
  }
  if (!crypto.subtle && !localInsecureDevHost()) {
    throw new Error("This page is not a secure context, so the browser will not create a sign-in key.");
  }

  const record = crypto.subtle
    ? await generateWebCryptoDeviceKey()
    : generateSoftwareDeviceKey();
  await idbRequest("readwrite", (store) => store.put(record, KEY_ID));
  return record;
}

export async function deleteDeviceKey() {
  clearAccessToken();
  if (typeof indexedDB === "undefined") return;
  await idbRequest("readwrite", (store) => store.delete(KEY_ID));
}

export function rememberLoginState(loginUrl: string) {
  const state = new URL(loginUrl).searchParams.get("state");
  if (!state) throw new Error("Sign-in did not include a state value.");
  sessionStorage.setItem(LOGIN_STATE_KEY, state);
}

export async function signProof(input: {
  key: DeviceKey;
  method: string;
  url: string;
  accessToken?: string;
}) {
  const header = {
    typ: "dpop+jwt",
    alg: "ES256",
    jwk: input.key.publicJwk,
  };
  const claims: Record<string, unknown> = {
    htm: input.method.toUpperCase(),
    htu: proofUrl(input.url),
    iat: Math.floor(Date.now() / 1000),
    jti: createUuid(),
  };
  if (input.accessToken) {
    const digest = await sha256Bytes(new TextEncoder().encode(input.accessToken));
    claims.ath = bytesToBase64Url(digest);
  }
  const signingInput = `${jsonToBase64Url(header)}.${jsonToBase64Url(claims)}`;
  const signature = await signEs256(input.key.privateKey, new TextEncoder().encode(signingInput));
  return `${signingInput}.${bytesToBase64Url(signature)}`;
}

async function refreshFromCookie(): Promise<string | null> {
  const key = await loadDeviceKey();
  if (!key) return null;
  const proof = await signProof({ key, method: "POST", url: atriumTokenUrl() });
  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/api/access/web/refresh`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        DPoP: proof,
      },
      body: JSON.stringify({ device_label: browserDeviceLabel() }),
    },
  );
  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
  } | null;
  if (!response.ok || !body?.access_token) {
    clearAccessToken();
    return null;
  }
  setAccessToken(body.access_token);
  return body.access_token;
}

function browserHasDpopSession() {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .some((entry) => entry.startsWith(`${DPOP_COOKIE}=`));
}

export async function ensureAccessToken(): Promise<string | null> {
  if (accessToken && tokenStillValid(accessToken)) return accessToken;
  accessToken = null;
  if (!browserHasDpopSession()) return null;
  if (!refreshInFlight) {
    refreshInFlight = refreshFromCookie().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function resourceProofHeaders(
  method: string,
  url: string,
): Promise<Record<string, string>> {
  const token = await ensureAccessToken();
  if (!token) return {};
  const key = await loadDeviceKey();
  if (!key) {
    clearAccessToken();
    return {};
  }
  const proof = await signProof({ key, method, url, accessToken: token });
  return {
    Authorization: `DPoP ${token}`,
    DPoP: proof,
  };
}

export async function exchangeWebLogin(code: string, state: string) {
  const expected = sessionStorage.getItem(LOGIN_STATE_KEY);
  if (expected && expected !== state) {
    throw new Error("Login state did not match this browser.");
  }
  const key = await ensureDeviceKey();
  const proof = await signProof({ key, method: "POST", url: atriumTokenUrl() });
  const response = await fetch(
    `${runtimeConfig.apiBaseUrl}/api/access/web/exchange`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        DPoP: proof,
      },
      body: JSON.stringify({
        code,
        state,
        device_label: browserDeviceLabel(),
      }),
    },
  );
  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
    code?: string;
  } | null;
  if (!response.ok || !body?.access_token) {
    if (body?.code === "DPOP_REVOKED") await deleteDeviceKey();
    throw new Error(body?.error || "Sign-in could not be completed.");
  }
  setAccessToken(body.access_token);
  sessionStorage.removeItem(LOGIN_STATE_KEY);
}

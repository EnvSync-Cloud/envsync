import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import { p256 } from "@noble/curves/nist.js";

import {
  clearAccessToken,
  proofUrl,
  resourceRequestUrl,
  setAccessToken,
  signProof,
  type DeviceKey,
  type SoftwarePrivateKey,
} from "./dpop-session";

function decodePart(part: string) {
  const padded = part.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return JSON.parse(json) as Record<string, unknown>;
}

async function deviceKey(): Promise<DeviceKey> {
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

function storageContains(token: string) {
  const buckets = [globalThis.localStorage, globalThis.sessionStorage].filter(
    Boolean,
  );
  for (const bucket of buckets) {
    for (let index = 0; index < bucket.length; index += 1) {
      const key = bucket.key(index);
      if (!key) continue;
      if (key.includes(token) || bucket.getItem(key)?.includes(token))
        return true;
    }
  }
  return false;
}

describe("dashboard DPoP session", () => {
  test("signs a resource proof as DPoP and keeps the access token out of storage", async () => {
    const key = await deviceKey();
    const accessToken = "super-secret-access-token";
    setAccessToken(accessToken);
    const proof = await signProof({
      key,
      method: "get",
      url: "https://api.envsync.cloud/api/auth/me?org=1#hash",
      accessToken,
    });

    const [encodedHeader, encodedClaims] = proof.split(".");
    const header = decodePart(encodedHeader);
    const claims = decodePart(encodedClaims);
    expect(header.typ).toBe("dpop+jwt");
    expect(header.alg).toBe("ES256");
    expect(JSON.stringify(header.jwk)).not.toContain('"d"');
    expect(claims.htm).toBe("GET");
    expect(claims.htu).toBe(proofUrl("https://api.envsync.cloud/api/auth/me"));
    expect(typeof claims.ath).toBe("string");
    expect(proof).not.toContain(accessToken);
    expect(storageContains(accessToken)).toBe(false);
    clearAccessToken();
  });

  test("omits ath on a token-endpoint proof", async () => {
    const key = await deviceKey();
    const proof = await signProof({
      key,
      method: "POST",
      url: "https://auth.envsync.cloud/oauth/token",
    });
    const claims = decodePart(proof.split(".")[1]);
    expect(claims.htu).toBe("https://auth.envsync.cloud/oauth/token");
    expect(claims.ath).toBeUndefined();
  });

  test("signs with a software P-256 key when WebCrypto is unavailable", async () => {
    const { secretKey } = p256.keygen();
    const uncompressed = p256.getPublicKey(secretKey, false);
    const bytesToBase64Url = (bytes: Uint8Array) => {
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    };
    const privateKey: SoftwarePrivateKey = {
      software: "p256",
      d: bytesToBase64Url(secretKey),
    };
    const key: DeviceKey = {
      privateKey,
      publicJwk: {
        kty: "EC",
        crv: "P-256",
        x: bytesToBase64Url(uncompressed.slice(1, 33)),
        y: bytesToBase64Url(uncompressed.slice(33, 65)),
      },
    };
    const browserCrypto = globalThis.crypto;
    const accessToken = "fixture-access-token";
    const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto")!;
    let proof: string;
    try {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: { getRandomValues: browserCrypto.getRandomValues.bind(browserCrypto) },
      });
      proof = await signProof({
        key,
        method: "GET",
        url: "http://api.lvh.me:4000/api/auth/me",
        accessToken,
      });
    } finally {
      Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
    }
    const [encodedHeader, encodedClaims, encodedSignature] = proof.split(".");
    const header = decodePart(encodedHeader);
    expect(header.alg).toBe("ES256");
    expect(header.jwk).toEqual(key.publicJwk);
    const claims = decodePart(encodedClaims);
    expect(claims.ath).toBe(createHash("sha256").update(accessToken).digest("base64url"));
    expect(claims.jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`);
    const paddedSignature = encodedSignature.replace(/-/g, "+").replace(/_/g, "/")
      + "=".repeat((4 - (encodedSignature.length % 4)) % 4);
    const signature = Uint8Array.from(atob(paddedSignature), (char) => char.charCodeAt(0));
    expect(p256.verify(signature, signingInput, uncompressed, { lowS: true, prehash: true })).toBe(true);
  });

  test("fills path parameters before the proof URL is signed", () => {
    expect(
      resourceRequestUrl("https://api.envsync.cloud/", "/api/apps/{app_id}/env/{env_type_id}", {
        app_id: "app 1",
        env_type_id: "env/1",
      }),
    ).toBe("https://api.envsync.cloud/api/apps/app%201/env/env/1");
  });
});

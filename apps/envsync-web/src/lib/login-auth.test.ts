import { describe, expect, test } from "bun:test";

import {
  isPublicAuthPath,
  isSafeHttpRedirectUrl,
  requestSsoRedirectUrl,
  SSO_START_ERROR,
  ssoErrorFromSearch,
} from "./login-auth";

describe("isPublicAuthPath", () => {
  test("treats login, callback, and invite accept as public", () => {
    expect(isPublicAuthPath("/login")).toBe(true);
    expect(isPublicAuthPath("/auth/callback")).toBe(true);
    expect(isPublicAuthPath("/onboarding/accept-user-invite/abc")).toBe(true);
  });

  test("does not treat product routes as public", () => {
    expect(isPublicAuthPath("/")).toBe(false);
    expect(isPublicAuthPath("/dashboard")).toBe(false);
    expect(isPublicAuthPath("/organisation")).toBe(false);
  });
});

describe("ssoErrorFromSearch", () => {
  test("maps ?sso=failed to the generic chooser error", () => {
    expect(ssoErrorFromSearch("failed")).toBe(SSO_START_ERROR);
    expect(ssoErrorFromSearch(null)).toBeNull();
    expect(ssoErrorFromSearch("ok")).toBeNull();
  });
});

describe("isSafeHttpRedirectUrl", () => {
  test("allows http(s) IdP URLs", () => {
    expect(isSafeHttpRedirectUrl("https://idp.example.com/sso?SAMLRequest=abc")).toBe(true);
    expect(isSafeHttpRedirectUrl("http://localhost:8080/auth")).toBe(true);
  });

  test("rejects non-http schemes and garbage", () => {
    expect(isSafeHttpRedirectUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpRedirectUrl("data:text/html,hi")).toBe(false);
    expect(isSafeHttpRedirectUrl("/relative")).toBe(false);
    expect(isSafeHttpRedirectUrl("not a url")).toBe(false);
  });
});

describe("requestSsoRedirectUrl", () => {
  test("POSTs JSON with credentials and returns a safe redirect_url", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const redirectUrl = "https://idp.example.com/sso?SAMLRequest=abc";
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ redirect_url: redirectUrl, request_id: "req_1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await requestSsoRedirectUrl("http://api.lvh.me:4000/", "acme corp", fetchImpl);

    expect(result).toBe(redirectUrl);
    expect(calls).toHaveLength(1);
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.credentials).toBe("include");
    expect(calls[0].init.body).toBe("{}");
    expect(calls[0].url).toBe("http://api.lvh.me:4000/api/saml/sso/acme%20corp");
  });

  test("returns null for 404, missing redirect_url, or unsafe schemes", async () => {
    const notFound = await requestSsoRedirectUrl("http://api.lvh.me:4000", "missing", async () =>
      new Response(JSON.stringify({ error: "SSO is not available", code: "SSO_NOT_AVAILABLE" }), { status: 404 }),
    );
    expect(notFound).toBeNull();

    const missingUrl = await requestSsoRedirectUrl("http://api.lvh.me:4000", "acme", async () =>
      new Response(JSON.stringify({ request_id: "req_1" }), { status: 200 }),
    );
    expect(missingUrl).toBeNull();

    const unsafe = await requestSsoRedirectUrl("http://api.lvh.me:4000", "acme", async () =>
      new Response(JSON.stringify({ redirect_url: "javascript:alert(1)" }), { status: 200 }),
    );
    expect(unsafe).toBeNull();
  });
});

import { describe, expect, test } from "bun:test";

import { isSafeHttpRedirectUrl, publishedSpUrls, samlProviderLabel } from "./saml-sp";

describe("saml-sp helpers", () => {
  test("publishes public /api/saml aliases", () => {
    const urls = publishedSpUrls("https://api.example.com/", "org_123", "acme");
    expect(urls.entityId).toBe("https://api.example.com/api/saml/metadata/org_123");
    expect(urls.acsUrl).toBe("https://api.example.com/api/saml/acs/org_123");
    expect(urls.startUrl).toBe("https://api.example.com/api/saml/sso/acme");
    expect(urls.metadataUrl).toBe(urls.entityId);
  });

  test("rejects non-http redirects for test login", () => {
    expect(isSafeHttpRedirectUrl("https://idp.example.com/sso?SAMLRequest=abc")).toBe(true);
    expect(isSafeHttpRedirectUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpRedirectUrl("/relative")).toBe(false);
  });

  test("labels known IdP types", () => {
    expect(samlProviderLabel("azure-ad")).toBe("Azure AD");
    expect(samlProviderLabel("custom")).toBe("custom");
  });
});

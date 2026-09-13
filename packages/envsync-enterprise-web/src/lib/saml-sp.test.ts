import { describe, expect, test } from "bun:test";

import {
  isSafeHttpRedirectUrl,
  parseSpMetadataXml,
  publishedSpUrls,
  samlProviderLabel,
  startUrlFromEntityId,
} from "./saml-sp";

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

  test("parses entityID and ACS from SP metadata XML", () => {
    const xml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="https://api.example.com/api/saml/metadata/org_123">`,
      `<md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://api.example.com/api/saml/acs/org_123" index="0" isDefault="true" />`,
      `</md:EntityDescriptor>`,
    ].join("");
    expect(parseSpMetadataXml(xml)).toEqual({
      entityId: "https://api.example.com/api/saml/metadata/org_123",
      acsUrl: "https://api.example.com/api/saml/acs/org_123",
    });
    expect(startUrlFromEntityId("https://api.example.com/api/saml/metadata/org_123", "acme"))
      .toBe("https://api.example.com/api/saml/sso/acme");
  });
});

export const SAML_PROVIDER_TYPES = [
  "okta",
  "onelogin",
  "azure-ad",
  "google-workspace",
  "duo",
  "rippling",
  "oracle",
  "ping-identity",
] as const;

export type SamlProviderType = (typeof SAML_PROVIDER_TYPES)[number];

const PROVIDER_LABELS: Record<SamlProviderType, string> = {
  okta: "Okta",
  onelogin: "OneLogin",
  "azure-ad": "Azure AD",
  "google-workspace": "Google Workspace",
  duo: "Duo",
  rippling: "Rippling",
  oracle: "Oracle",
  "ping-identity": "Ping Identity",
};

export function samlProviderLabel(type: string) {
  return PROVIDER_LABELS[type as SamlProviderType] ?? type;
}

export function publishedSpUrls(apiBaseUrl: string, orgId: string, orgSlug: string) {
  const base = apiBaseUrl.replace(/\/$/, "");
  return {
    entityId: `${base}/api/saml/metadata/${orgId}`,
    acsUrl: `${base}/api/saml/acs/${orgId}`,
    startUrl: `${base}/api/saml/sso/${encodeURIComponent(orgSlug)}`,
    metadataUrl: `${base}/api/saml/metadata/${orgId}`,
  };
}

function decodeXmlAttr(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

/** Prefer server-published identifiers from SP metadata over dashboard apiBaseUrl. */
export function parseSpMetadataXml(xml: string) {
  const entityId = xml.match(/\bentityID="([^"]+)"/i)?.[1];
  const acsUrl = xml.match(/<md:AssertionConsumerService\b[^>]*\bLocation="([^"]+)"/i)?.[1]
    ?? xml.match(/<AssertionConsumerService\b[^>]*\bLocation="([^"]+)"/i)?.[1];
  if (!entityId && !acsUrl) return null;
  return {
    entityId: entityId ? decodeXmlAttr(entityId) : undefined,
    acsUrl: acsUrl ? decodeXmlAttr(acsUrl) : undefined,
  };
}

export function startUrlFromEntityId(entityId: string, orgSlug: string) {
  try {
    return `${new URL(entityId).origin}/api/saml/sso/${encodeURIComponent(orgSlug)}`;
  } catch {
    return null;
  }
}

export function isSafeHttpRedirectUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const SSO_START_ERROR = "We couldn't start SSO for that organization.";
export const SSO_SLUG_KEY = "envsync_sso_slug";

export function isPublicAuthPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/onboarding/accept-user-invite")
  );
}

export function isSafeHttpRedirectUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function ssoErrorFromSearch(sso: string | null) {
  return sso === "failed" ? SSO_START_ERROR : null;
}

export async function requestSsoRedirectUrl(
  apiBaseUrl: string,
  orgSlug: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const response = await fetchImpl(
    `${apiBaseUrl.replace(/\/$/, "")}/api/saml/sso/${encodeURIComponent(orgSlug)}`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
  );
  const body = (await response.json().catch(() => null)) as { redirect_url?: string } | null;
  if (!response.ok || !body?.redirect_url || !isSafeHttpRedirectUrl(body.redirect_url)) {
    return null;
  }
  return body.redirect_url;
}

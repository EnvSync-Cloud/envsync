import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";

import { getSDK } from "@/api/base";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthContext } from "@/contexts/auth";
import { runtimeConfig } from "@/utils/runtime-config";

const SSO_SLUG_KEY = "envsync_sso_slug";
const SSO_START_ERROR = "We couldn't start SSO for that organization.";

function readStoredSlug() {
  try {
    return localStorage.getItem(SSO_SLUG_KEY) ?? "";
  } catch {
    return "";
  }
}

function persistSlug(slug: string) {
  try {
    localStorage.setItem(SSO_SLUG_KEY, slug);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isLoading } = useAuthContext();
  const showSso = runtimeConfig.edition !== "oss";
  const [slug, setSlug] = useState(readStoredSlug);
  const [ssoError, setSsoError] = useState(
    searchParams.get("sso") === "failed" ? SSO_START_ERROR : null,
  );
  const [keycloakError, setKeycloakError] = useState<string | null>(null);
  const [keycloakPending, setKeycloakPending] = useState(false);
  const [ssoPending, setSsoPending] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const handleKeycloakLogin = async () => {
    setKeycloakError(null);
    setKeycloakPending(true);
    try {
      const response = await getSDK().access.createWebLogin();
      if (response?.loginUrl) {
        window.location.href = response.loginUrl;
        return;
      }
      setKeycloakError("We couldn't start sign-in. Please try again.");
    } catch {
      setKeycloakError("We couldn't start sign-in. Please try again.");
    } finally {
      setKeycloakPending(false);
    }
  };

  const handleSsoLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const orgSlug = slug.trim();
    if (!orgSlug || ssoPending) return;

    persistSlug(orgSlug);
    setSsoError(null);
    setSsoPending(true);
    try {
      // JSON POST only — never GET-navigate to the API (errors must stay on /login).
      const response = await fetch(
        `${runtimeConfig.apiBaseUrl.replace(/\/$/, "")}/api/saml/sso/${encodeURIComponent(orgSlug)}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      const body = (await response.json().catch(() => null)) as { redirect_url?: string } | null;
      if (!response.ok || !body?.redirect_url) {
        setSsoError(SSO_START_ERROR);
        return;
      }
      window.location.assign(body.redirect_url);
    } catch {
      setSsoError(SSO_START_ERROR);
    } finally {
      setSsoPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Card className="border-border shadow-lg">
          <CardHeader className="text-center">
            <img src="/EnvSync.svg" alt="EnvSync" className="mx-auto mb-4 size-12" />
            <CardTitle className="text-2xl">Sign in to EnvSync</CardTitle>
            <CardDescription>Choose how you want to continue.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button
              type="button"
              data-testid="login-keycloak"
              className="w-full"
              disabled={keycloakPending || ssoPending}
              onClick={() => void handleKeycloakLogin()}
            >
              {keycloakPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Redirecting…
                </>
              ) : (
                "Continue with EnvSync"
              )}
            </Button>

            {keycloakError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{keycloakError}</span>
              </div>
            )}

            {showSso && (
              <>
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>

                <form className="space-y-4" onSubmit={(event) => void handleSsoLogin(event)}>
                  <div className="space-y-2">
                    <Label htmlFor="org-slug">Organization slug</Label>
                    <Input
                      id="org-slug"
                      data-testid="login-sso-slug"
                      value={slug}
                      onChange={(event) => setSlug(event.target.value)}
                      autoComplete="organization"
                      placeholder="acme-corp"
                      disabled={ssoPending || keycloakPending}
                    />
                  </div>

                  {ssoError && (
                    <div
                      role="alert"
                      data-testid="login-sso-error"
                      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{ssoError}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="outline"
                    data-testid="login-sso-submit"
                    className="w-full"
                    disabled={ssoPending || keycloakPending || !slug.trim()}
                  >
                    {ssoPending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Starting SSO…
                      </>
                    ) : (
                      "Continue with SSO"
                    )}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;

import { toast } from "sonner";
import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";

import {
  useActivateLicense,
  useManagementSystemStatus,
  useVerifyLicense,
} from "../api/hooks";
import { isEnterpriseUiEnabled } from "../api/client";
import { Badge } from "@shell/components/ui/badge";
import { Button } from "@shell/components/ui/button";
import { useAuthContext } from "@shell/contexts/auth";

const FEATURE_LABELS: Record<string, string> = {
  log_forwarding: "Log forwarding",
  multi_org: "Multiple organizations",
  saml: "SAML SSO",
  oidc: "OIDC SSO",
  kms: "Key management",
  integrations: "Integrations",
  rotation: "Secret rotation",
  dynamic_secrets: "Dynamic secrets",
  management: "Manage API",
  change_requests: "Change requests",
  point_in_time: "Point in time",
  byok_secrets: "BYOK secrets",
  certificates: "Certificates",
};

const LICENSE_STATUS_LABELS: Record<string, string> = {
  unknown: "Not activated",
  active: "Active",
  inactive: "Inactive",
  expired: "Expired",
  error: "Error",
  locked: "Locked",
};

const PLAN_LABELS: Record<string, string> = {
  developer: "Developer",
  plus: "Plus+",
  enterprise: "Enterprise",
};

function featureLabel(id: string) {
  return FEATURE_LABELS[id] ?? id.replaceAll("_", " ");
}

function FeatureList({ label, features, empty }: { label: string; features: string[]; empty: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground">{label}</h3>
      {features.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {features.map(feature => (
            <Badge key={feature} variant="outline">
              {featureLabel(feature)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LicenseSettings() {
  const enabled = isEnterpriseUiEnabled();
  const { user } = useAuthContext();
  const { data: status, isLoading, isError, error, refetch, isFetching } = useManagementSystemStatus();
  const activate = useActivateLicense();
  const verify = useVerifyLicense();

  const license = status?.license;
  const system = status?.system as { deployment_mode?: string } | undefined;
  const session = user as {
    features?: string[];
    plan?: string;
    feature_overrides?: string[];
  } | null;

  const hosted = system?.deployment_mode === "hosted";
  const orgFeatures = session?.features ?? [];
  const overlay = session?.feature_overrides ?? [];
  const plan = session?.plan;
  const licenseStatus = license?.state?.status ?? "unknown";
  const busy = activate.isPending || verify.isPending;

  const onActivate = async () => {
    try {
      const res = await activate.mutateAsync();
      toast.success(res.message || "License activated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Activate failed");
    }
  };

  const onVerify = async () => {
    try {
      const res = await verify.mutateAsync();
      toast.success(res.message || "License verified");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verify failed");
    }
  };

  if (!enabled) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">License</h1>
        <p className="text-sm text-muted-foreground">
          Enterprise modules are not enabled on this dashboard build.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">{hosted ? "Plan" : "License"}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {hosted
              ? "Hosted organizations are gated by plan and optional feature overlays. A license file is not used here."
              : "Self-host Enterprise uses a license lease or certificate. Activate it to unlock the install catalog."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load system status"}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {hosted ? (
            <article className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-lg font-medium">This organization</h2>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Plan</dt>
                  <dd className="font-medium">{plan ? (PLAN_LABELS[plan] ?? plan) : "—"}</dd>
                </div>
              </dl>
              <FeatureList
                label="Preview flags"
                features={overlay}
                empty="No extra flags. Plan defaults only."
              />
            </article>
          ) : (
            <article className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="size-5 text-primary" />
                <h2 className="text-lg font-medium">License</h2>
              </div>
              <p className="flex items-center gap-2 text-sm">
                Status
                <Badge variant={licenseStatus === "active" ? "default" : "outline"}>
                  {LICENSE_STATUS_LABELS[licenseStatus] ?? licenseStatus}
                </Badge>
              </p>
              {licenseStatus === "unknown" && (
                <p className="text-sm text-muted-foreground">
                  No license is active on this install yet.
                </p>
              )}
              {license?.state?.lease_expires_at && (
                <p className="text-sm text-muted-foreground">
                  Lease expires{" "}
                  <strong className="text-foreground">
                    {new Date(license.state.lease_expires_at).toLocaleString()}
                  </strong>
                </p>
              )}
              {license?.state?.last_error_message && (
                <p className="text-sm text-amber-600 dark:text-amber-200">{license.state.last_error_message}</p>
              )}
              {license?.required !== false && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={() => void onActivate()} disabled={busy}>
                    <ShieldCheck className="size-4" />
                    Activate license
                  </Button>
                  <Button variant="outline" onClick={() => void onVerify()} disabled={busy}>
                    Verify lease
                  </Button>
                </div>
              )}
            </article>
          )}

          <article className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-lg font-medium">Features</h2>
            <FeatureList
              label="Available in this organization"
              features={orgFeatures}
              empty="No extra features on this plan."
            />
          </article>
        </div>
      )}
    </div>
  );
}

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

const FEATURE_CATALOG: Array<{ id: string; label: string; limitKey?: string }> = [
  { id: "change_requests", label: "Change requests", limitKey: "change_requests" },
  { id: "point_in_time", label: "Point in time", limitKey: "point_in_time" },
  { id: "byok_secrets", label: "BYOK secrets", limitKey: "byok_secrets" },
  { id: "certificates", label: "Certificates", limitKey: "certificates" },
  { id: "oidc", label: "OIDC SSO" },
  { id: "saml", label: "SAML SSO" },
  { id: "rotation", label: "Secret rotation", limitKey: "rotation" },
  { id: "dynamic_secrets", label: "Dynamic secrets" },
  { id: "log_forwarding", label: "Log forwarding" },
  { id: "integrations", label: "Integrations", limitKey: "integrations" },
  { id: "kms", label: "Key management" },
];

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

type FeatureSource = "plan" | "preview" | "off";

function resolveFeatureSource(
  id: string,
  limitKey: string | undefined,
  overlay: string[],
  features: string[],
  limits: Record<string, unknown> | undefined,
): FeatureSource {
  if (overlay.includes(id)) return "preview";
  if (features.includes(id)) return "plan";
  if (limitKey && limits?.[limitKey] === true) return "plan";
  return "off";
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
    plan_limits?: Record<string, unknown>;
    feature_overrides?: string[];
  } | null;

  const hosted = system?.deployment_mode === "hosted";
  const orgFeatures = session?.features ?? [];
  const overlay = session?.feature_overrides ?? [];
  const plan = session?.plan;
  const featureRows = FEATURE_CATALOG.map(item => ({
    ...item,
    source: resolveFeatureSource(item.id, item.limitKey, overlay, orgFeatures, session?.plan_limits),
  }));
  const enabledRows = featureRows.filter(row => row.source !== "off");
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
        <div className="grid gap-4">
          {hosted ? (
            <article className="rounded-xl border border-border bg-card p-6 space-y-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-lg font-medium">This organization</h2>
                <p className="text-sm text-muted-foreground">
                  Plan <span className="font-medium text-foreground">{plan ? (PLAN_LABELS[plan] ?? plan) : "—"}</span>
                </p>
              </div>
              {enabledRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No extra features on this plan.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {enabledRows.map(row => (
                    <li key={row.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                      <span>{row.label}</span>
                      <Badge variant={row.source === "preview" ? "default" : "outline"}>
                        {row.source === "preview" ? "Preview" : "On plan"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ) : (
            <>
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
            <article className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h2 className="text-lg font-medium">Features</h2>
              {enabledRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No extra features on this plan.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {enabledRows.map(row => (
                    <li key={row.id} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                      <span>{row.label}</span>
                      <Badge variant="outline">Included</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </>
          )}
        </div>
      )}
    </div>
  );
}

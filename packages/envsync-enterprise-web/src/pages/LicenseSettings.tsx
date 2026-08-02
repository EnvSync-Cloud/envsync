import { toast } from "sonner";
import { Link } from "react-router-dom";
import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";

import {
  useActivateLicense,
  useManagementSystemStatus,
  useVerifyLicense,
} from "../api/hooks";
import { isEnterpriseUiEnabled } from "../api/client";
import { Badge } from "@shell/components/ui/badge";
import { Button } from "@shell/components/ui/button";

/**
 * Enterprise license + install status (absorbed from envsync-management-web).
 * Route: /organisation/license
 */
export default function LicenseSettings() {
  const enabled = isEnterpriseUiEnabled();
  const { data: status, isLoading, isError, error, refetch, isFetching } = useManagementSystemStatus();
  const activate = useActivateLicense();
  const verify = useVerifyLicense();

  const license = status?.license;
  const system = status?.system;
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
          Management API is not configured for this deployment. Set{" "}
          <code className="text-xs">managementApiUrl</code> in runtime config for enterprise license controls.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300/80">
          Enterprise
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-foreground">License & install</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Activate or verify the self-host enterprise entitlement against the management API.
              Provider connections and org secrets live under{" "}
              <Link className="text-emerald-600 underline-offset-2 hover:underline" to="/organisation/integrations">
                Organisation → Integrations
              </Link>
              .
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error instanceof Error ? error.message : "Failed to load system status"}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-border bg-card/50 p-8 text-sm text-muted-foreground">
          Loading license state…
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-border bg-card/50 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="size-5 text-emerald-500" />
              <h2 className="text-lg font-medium">License</h2>
            </div>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                Status{" "}
                <Badge variant="outline" className="font-mono">
                  {license?.state?.status ?? "unknown"}
                </Badge>
              </p>
              {license?.state?.lease_expires_at && (
                <p className="text-muted-foreground">
                  Lease expires{" "}
                  <strong className="text-foreground">
                    {new Date(license.state.lease_expires_at).toLocaleString()}
                  </strong>
                </p>
              )}
              {license?.state?.last_error_message && (
                <p className="text-amber-200/90 text-xs">{license.state.last_error_message}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => void onActivate()} disabled={busy}>
                <ShieldCheck className="size-4" />
                Activate license
              </Button>
              <Button variant="outline" onClick={() => void onVerify()} disabled={busy}>
                Verify lease
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card/50 p-6 space-y-4">
            <h2 className="text-lg font-medium">Install</h2>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Edition</dt>
                <dd className="font-medium">{system?.edition ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Organizations</dt>
                <dd className="font-medium">{system?.org_count ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Single-org mode</dt>
                <dd className="font-medium">{system?.single_org_mode ? "yes" : "no"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Management API</dt>
                <dd className="font-medium">{system?.management_enabled ? "enabled" : "disabled"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Observability</dt>
                <dd className="font-medium">{system?.observability_enabled ? "enabled" : "disabled"}</dd>
              </div>
            </dl>
          </article>
        </div>
      )}
    </div>
  );
}

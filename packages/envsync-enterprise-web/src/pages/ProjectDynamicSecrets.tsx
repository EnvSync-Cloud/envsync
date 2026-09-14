import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { DynamicSecretEngineResponse } from "@envsync-cloud/envsync-ts-sdk";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { getEnterpriseSDK, isEnterpriseUiEnabled } from "../api/client";
import {
  useCreateDynamicSecretLease,
  useDynamicSecretEngines,
  useDynamicSecretLeases,
  useRevokeDynamicSecretLease,
} from "../api/ee-workloads";
import { EnterprisePageFrame } from "../components/EnterprisePageFrame";
import { ProjectSettingsTabs } from "@shell/components/ProjectSettingsTabs";
import { Badge } from "@shell/components/ui/badge";
import { Button } from "@shell/components/ui/button";
import { Input } from "@shell/components/ui/input";
import { Label } from "@shell/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@shell/components/ui/sheet";

export default function ProjectDynamicSecrets() {
  const { appId = "" } = useParams();
  const enabled = isEnterpriseUiEnabled();
  const { data: engines = [], isLoading, isError, error, refetch, isFetching } = useDynamicSecretEngines();
  const createLease = useCreateDynamicSecretLease();
  const revokeLease = useRevokeDynamicSecretLease();

  const { data: envTypes = [] } = useQuery({
    queryKey: ["enterprise", "app-env-types", appId],
    queryFn: async () => {
      const app = await getEnterpriseSDK().applications.getApp(appId);
      return app.env_types.map((envType) => ({ id: envType.id, name: envType.name }));
    },
    enabled: enabled && Boolean(appId),
  });

  const [leaseEngine, setLeaseEngine] = useState<DynamicSecretEngineResponse | null>(null);
  const [leaseEnvTypeId, setLeaseEnvTypeId] = useState("");
  const [leaseKey, setLeaseKey] = useState("");
  const { data: leases = [] } = useDynamicSecretLeases(leaseEngine?.id);

  const projectLeases = useMemo(
    () => leases.filter((lease) => !lease.revoked_at && lease.app_id === appId),
    [leases, appId],
  );

  const onIssueLease = async () => {
    if (!leaseEngine || !appId || !leaseEnvTypeId || !leaseKey.trim()) {
      toast.error("Environment and variable key are required.");
      return;
    }
    try {
      await createLease.mutateAsync({
        engineId: leaseEngine.id,
        app_id: appId,
        env_type_id: leaseEnvTypeId,
        variable_key: leaseKey.trim(),
      });
      toast.success("Lease issued.");
      setLeaseKey("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to issue lease.");
    }
  };

  return (
    <EnterprisePageFrame
      title="Dynamic secrets"
      description="Issue a short-lived credential from an organization engine into this project."
      enabled={enabled}
      isError={isError}
      error={error}
      actions={
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      <ProjectSettingsTabs appId={appId} active="dynamic-secrets" />
      <p className="text-sm text-muted-foreground">
        Engines are organization-scoped.{" "}
        <Link to="/organisation/dynamic-secrets" className="underline underline-offset-4">
          Manage engines
        </Link>
      </p>
      <div className="space-y-3">
        {engines.length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">No organization engines yet.</p>
        ) : (
          engines.map((engine) => (
            <article key={engine.id} className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium text-foreground">{engine.name}</h2>
                  <Badge variant="outline">{engine.engine_type}</Badge>
                  <Badge variant="outline">{engine.enabled ? "Enabled" : "Disabled"}</Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!engine.enabled}
                  onClick={() => setLeaseEngine(engine)}
                >
                  Issue lease
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      <Sheet open={Boolean(leaseEngine)} onOpenChange={(open) => !open && setLeaseEngine(null)}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Issue lease</SheetTitle>
            <SheetDescription>
              Writes a short-lived credential into a variable in this project.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lease-env">Environment</Label>
              <select
                id="lease-env"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={leaseEnvTypeId}
                onChange={(event) => setLeaseEnvTypeId(event.target.value)}
              >
                <option value="">Select environment</option>
                {envTypes.map((envType) => (
                  <option key={envType.id} value={envType.id}>
                    {envType.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lease-key">Variable key</Label>
              <Input id="lease-key" value={leaseKey} onChange={(event) => setLeaseKey(event.target.value)} />
            </div>
            <Button onClick={() => void onIssueLease()} disabled={createLease.isPending}>
              Issue lease
            </Button>
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Active leases for this project</h3>
              {projectLeases.length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                projectLeases.map((lease) => (
                  <div key={lease.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div>
                      <p className="font-mono text-xs">{lease.variable_key}</p>
                      <p className="text-xs text-muted-foreground">
                        Expires {new Date(lease.expires_at).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        revokeLease.mutate(
                          { engineId: leaseEngine!.id, leaseId: lease.id },
                          {
                            onSuccess: () => toast.success("Lease revoked."),
                            onError: (err) => toast.error(err instanceof Error ? err.message : "Revoke failed."),
                          },
                        )
                      }
                    >
                      Revoke
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </EnterprisePageFrame>
  );
}

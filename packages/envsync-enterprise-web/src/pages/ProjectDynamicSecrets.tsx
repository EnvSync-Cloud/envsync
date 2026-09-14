import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { DynamicSecretEngineResponse } from "@envsync-cloud/envsync-ts-sdk";
import { CreateDynamicSecretEngineRequest } from "@envsync-cloud/envsync-ts-sdk";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2 } from "lucide-react";

import { getEnterpriseSDK, isEnterpriseUiEnabled } from "../api/client";
import {
  useCreateDynamicSecretEngine,
  useCreateDynamicSecretLease,
  useDeleteDynamicSecretEngine,
  useDynamicSecretEngines,
  useDynamicSecretLeases,
  useRevokeDynamicSecretLease,
  useUpdateDynamicSecretEngine,
} from "../api/ee-workloads";
import { ProjectSettingsTabs } from "@shell/components/ProjectSettingsTabs";
import { Badge } from "@shell/components/ui/badge";
import { Button } from "@shell/components/ui/button";
import { Input } from "@shell/components/ui/input";
import { Label } from "@shell/components/ui/label";
import { Switch } from "@shell/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@shell/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@shell/components/ui/sheet";

/**
 * Dynamic secret engines (postgres/mysql only).
 * Route: /projects/:appId/settings/dynamic-secrets
 */
export default function ProjectDynamicSecrets() {
  const { appId = "" } = useParams();
  const enabled = isEnterpriseUiEnabled();
  const { data: engines = [], isLoading, isError, error, refetch, isFetching } = useDynamicSecretEngines();
  const createEngine = useCreateDynamicSecretEngine();
  const updateEngine = useUpdateDynamicSecretEngine();
  const deleteEngine = useDeleteDynamicSecretEngine();
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

  const [sheetOpen, setSheetOpen] = useState(false);
  const [leaseEngine, setLeaseEngine] = useState<DynamicSecretEngineResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DynamicSecretEngineResponse | null>(null);
  const [name, setName] = useState("");
  const [engineType, setEngineType] = useState<CreateDynamicSecretEngineRequest.engine_type>(
    CreateDynamicSecretEngineRequest.engine_type.POSTGRES,
  );
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [leaseEnvTypeId, setLeaseEnvTypeId] = useState("");
  const [leaseKey, setLeaseKey] = useState("");

  const { data: leases = [] } = useDynamicSecretLeases(leaseEngine?.id);

  const activeLeases = useMemo(
    () => leases.filter((lease) => !lease.revoked_at),
    [leases],
  );

  const onCreate = async () => {
    if (!name.trim() || !host.trim() || !database.trim() || !username.trim() || !password) {
      toast.error("Name, host, database, and superuser credentials are required.");
      return;
    }
    try {
      await createEngine.mutateAsync({
        engine_type: engineType,
        name: name.trim(),
        enabled: true,
        config: {
          host: host.trim(),
          port: Number(port) || (engineType === "mysql" ? 3306 : 5432),
          database: database.trim(),
          superuser: { username: username.trim(), password },
        },
      });
      toast.success("Dynamic secret engine created.");
      setSheetOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create engine.");
    }
  };

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

  if (!enabled) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">Dynamic secrets</h1>
        <p className="text-sm text-muted-foreground">
          Enterprise modules are not enabled on this dashboard build.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <ProjectSettingsTabs appId={appId} active="dynamic-secrets" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300/80">
            Enterprise
          </p>
          <h1 className="text-3xl font-semibold text-foreground">Dynamic secrets</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Issue short-lived Postgres or MySQL credentials into a project variable. AWS and Azure
            stubs stay hidden.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setSheetOpen(true)} data-testid="create-dynamic-engine">
            <Plus className="size-4" />
            Add engine
          </Button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error instanceof Error ? error.message : "Failed to load engines"}
        </div>
      )}

      <div className="space-y-3">
        {engines.length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">No dynamic secret engines yet.</p>
        ) : (
          engines.map((engine) => (
            <article key={engine.id} className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium text-foreground">{engine.name}</h2>
                    <Badge variant="outline">{engine.engine_type}</Badge>
                    <Badge variant="outline">{engine.enabled ? "Enabled" : "Disabled"}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={engine.enabled}
                    onCheckedChange={(next) =>
                      updateEngine.mutate(
                        { id: engine.id, enabled: next },
                        {
                          onSuccess: () => toast.success(next ? "Engine enabled." : "Engine disabled."),
                          onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed."),
                        },
                      )
                    }
                  />
                  <Button variant="outline" size="sm" onClick={() => setLeaseEngine(engine)}>
                    Issue lease
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(engine)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add dynamic secret engine</SheetTitle>
            <SheetDescription>Only Postgres and MySQL are available.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dyn-name">Name</Label>
              <Input id="dyn-name" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dyn-engine">Engine</Label>
              <select
                id="dyn-engine"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={engineType}
                onChange={(event) =>
                  setEngineType(event.target.value as CreateDynamicSecretEngineRequest.engine_type)
                }
              >
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
              </select>
            </div>
            <Input placeholder="Host" value={host} onChange={(event) => setHost(event.target.value)} />
            <Input placeholder="Port" value={port} onChange={(event) => setPort(event.target.value)} />
            <Input placeholder="Database" value={database} onChange={(event) => setDatabase(event.target.value)} />
            <Input placeholder="Superuser" value={username} onChange={(event) => setUsername(event.target.value)} />
            <Input type="password" placeholder="Superuser password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <SheetFooter>
            <Button onClick={() => void onCreate()} disabled={createEngine.isPending}>
              Create engine
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
              <h3 className="text-sm font-medium">Active leases</h3>
              {activeLeases.length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                activeLeases.map((lease) => (
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

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete engine {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Existing leases stay until they expire or you revoke them.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                deleteEngine.mutate(deleteTarget.id, {
                  onSuccess: () => {
                    toast.success("Engine deleted.");
                    setDeleteTarget(null);
                  },
                  onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed."),
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

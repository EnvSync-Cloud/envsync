import { useState } from "react";
import type { DynamicSecretEngineResponse } from "@envsync-cloud/envsync-ts-sdk";
import { CreateDynamicSecretEngineRequest } from "@envsync-cloud/envsync-ts-sdk";
import { toast } from "sonner";
import { Database, Plus, RefreshCw, Trash2 } from "lucide-react";

import { isEnterpriseUiEnabled } from "../api/client";
import {
  useCreateDynamicSecretEngine,
  useDeleteDynamicSecretEngine,
  useDynamicSecretEngines,
  useUpdateDynamicSecretEngine,
} from "../api/ee-workloads";
import { EnterpriseDeleteDialog } from "../components/EnterpriseDeleteDialog";
import { EnterprisePageFrame } from "../components/EnterprisePageFrame";
import { Badge } from "@shell/components/ui/badge";
import { Button } from "@shell/components/ui/button";
import { Input } from "@shell/components/ui/input";
import { Label } from "@shell/components/ui/label";
import { Switch } from "@shell/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@shell/components/ui/sheet";

export default function OrgDynamicSecrets() {
  const enabled = isEnterpriseUiEnabled();
  const { data: engines = [], isLoading, isError, error, refetch, isFetching } = useDynamicSecretEngines();
  const createEngine = useCreateDynamicSecretEngine();
  const updateEngine = useUpdateDynamicSecretEngine();
  const deleteEngine = useDeleteDynamicSecretEngine();

  const [sheetOpen, setSheetOpen] = useState(false);
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

  return (
    <EnterprisePageFrame
      title="Dynamic secrets"
      description="Organization-wide Postgres and MySQL engines. Issue leases from a project."
      icon={<Database className="size-7" />}
      enabled={enabled}
      isError={isError}
      error={error}
      actions={
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
      }
    >
      <div className="space-y-3">
        {engines.length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">No dynamic secret engines yet.</p>
        ) : (
          engines.map((engine) => (
            <article key={engine.id} className="rounded-xl border border-border bg-card/60 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium text-foreground">{engine.name}</h2>
                  <Badge variant="outline">{engine.engine_type}</Badge>
                  <Badge variant="outline">{engine.enabled ? "Enabled" : "Disabled"}</Badge>
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

      <EnterpriseDeleteDialog
        open={Boolean(deleteTarget)}
        title={`Delete engine ${deleteTarget?.name}?`}
        description="Existing leases stay until they expire or you revoke them."
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteEngine.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success("Engine deleted.");
              setDeleteTarget(null);
            },
            onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed."),
          });
        }}
      />
    </EnterprisePageFrame>
  );
}

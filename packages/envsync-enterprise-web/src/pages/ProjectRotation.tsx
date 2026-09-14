import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { RotationPolicyResponse } from "@envsync-cloud/envsync-ts-sdk";
import { CreateRotationPolicyRequest } from "@envsync-cloud/envsync-ts-sdk";
import { toast } from "sonner";
import { Plus, RefreshCw, RotateCw, Trash2 } from "lucide-react";

import { isEnterpriseUiEnabled } from "../api/client";
import { getEnterpriseSDK } from "../api/client";
import {
  useCreateRotationPolicy,
  useDeleteRotationPolicy,
  useRotationPolicies,
  useTriggerRotation,
  useUpdateRotationPolicy,
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

const ENGINES = [
  { value: "postgres", label: "PostgreSQL" },
  { value: "mysql", label: "MySQL" },
  { value: "mongodb", label: "MongoDB" },
  { value: "aws-iam", label: "AWS IAM" },
] as const;

type EngineType = (typeof ENGINES)[number]["value"];

/**
 * Secret rotation policies for one project.
 * Route: /projects/:appId/settings/rotation
 */
export default function ProjectRotation() {
  const { appId = "" } = useParams();
  const enabled = isEnterpriseUiEnabled();
  const { data: policies = [], isLoading, isError, error, refetch, isFetching } = useRotationPolicies(appId);
  const createPolicy = useCreateRotationPolicy();
  const updatePolicy = useUpdateRotationPolicy();
  const deletePolicy = useDeleteRotationPolicy();
  const triggerRotation = useTriggerRotation();

  const { data: envTypes = [] } = useQuery({
    queryKey: ["enterprise", "app-env-types", appId],
    queryFn: async () => {
      const app = await getEnterpriseSDK().applications.getApp(appId);
      return app.env_types.map((envType) => ({ id: envType.id, name: envType.name }));
    },
    enabled: enabled && Boolean(appId),
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RotationPolicyResponse | null>(null);
  const [engineType, setEngineType] = useState<EngineType>("postgres");
  const [envTypeId, setEnvTypeId] = useState("");
  const [variableKey, setVariableKey] = useState("");
  const [schedule, setSchedule] = useState("0 3 * * *");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [adminUser, setAdminUser] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [iamUser, setIamUser] = useState("");
  const [region, setRegion] = useState("us-east-1");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");

  const envName = useMemo(() => {
    return Object.fromEntries(envTypes.map((envType) => [envType.id, envType.name]));
  }, [envTypes]);

  const connectionConfig = () => {
    if (engineType === "aws-iam") {
      return {
        iam_user: iamUser,
        region,
        access_key_id: accessKeyId,
        secret_access_key: secretAccessKey,
      };
    }
    return {
      host,
      port: Number(port) || (engineType === "mysql" ? 3306 : engineType === "mongodb" ? 27017 : 5432),
      database,
      admin_user: adminUser,
      admin_password: adminPassword,
    };
  };

  const onCreate = async () => {
    if (!appId || !envTypeId || !variableKey.trim()) {
      toast.error("Environment and variable key are required.");
      return;
    }
    try {
      await createPolicy.mutateAsync({
        app_id: appId,
        env_type_id: envTypeId,
        variable_key: variableKey.trim(),
        engine_type: engineType as CreateRotationPolicyRequest.engine_type,
        schedule_cron: schedule.trim() || "0 3 * * *",
        enabled: true,
        connection_config: connectionConfig(),
      });
      toast.success("Rotation policy created.");
      setSheetOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create policy.");
    }
  };

  if (!enabled) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">Rotation</h1>
        <p className="text-sm text-muted-foreground">
          Enterprise modules are not enabled on this dashboard build.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-8">
      <ProjectSettingsTabs appId={appId} active="rotation" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300/80">
            Enterprise
          </p>
          <h1 className="text-3xl font-semibold text-foreground">Rotation</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Rotate Postgres, MySQL, MongoDB, or AWS IAM credentials on a schedule. Hidden stub
            engines are not offered.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setSheetOpen(true)} data-testid="create-rotation-policy">
            <Plus className="size-4" />
            Add policy
          </Button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error instanceof Error ? error.message : "Failed to load rotation policies"}
        </div>
      )}

      <div className="space-y-3">
        {policies.length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">No rotation policies for this project.</p>
        ) : (
          policies.map((policy) => (
            <article
              key={policy.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-mono text-sm font-medium text-foreground">{policy.variable_key}</h2>
                  <Badge variant="outline">{policy.engine_type}</Badge>
                  <Badge variant="outline">{envName[policy.env_type_id] ?? policy.env_type_id}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cron {policy.schedule_cron}
                  {policy.next_rotation_at ? ` · next ${new Date(policy.next_rotation_at).toLocaleString()}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={policy.enabled}
                  onCheckedChange={(next) =>
                    updatePolicy.mutate(
                      { id: policy.id, appId, enabled: next },
                      {
                        onSuccess: () => toast.success(next ? "Policy enabled." : "Policy disabled."),
                        onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed."),
                      },
                    )
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    triggerRotation.mutate(
                      { id: policy.id, appId },
                      {
                        onSuccess: () => toast.success("Rotation triggered."),
                        onError: (err) => toast.error(err instanceof Error ? err.message : "Rotate failed."),
                      },
                    )
                  }
                >
                  <RotateCw className="size-4" />
                  Rotate
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(policy)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add rotation policy</SheetTitle>
            <SheetDescription>Writes the new credential into the selected variable.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rot-env">Environment</Label>
              <select
                id="rot-env"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={envTypeId}
                onChange={(event) => setEnvTypeId(event.target.value)}
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
              <Label htmlFor="rot-key">Variable key</Label>
              <Input id="rot-key" value={variableKey} onChange={(event) => setVariableKey(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rot-engine">Engine</Label>
              <select
                id="rot-engine"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={engineType}
                onChange={(event) => setEngineType(event.target.value as EngineType)}
              >
                {ENGINES.map((engine) => (
                  <option key={engine.value} value={engine.value}>
                    {engine.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rot-cron">Schedule (cron)</Label>
              <Input id="rot-cron" value={schedule} onChange={(event) => setSchedule(event.target.value)} />
            </div>
            {engineType === "aws-iam" ? (
              <>
                <Input placeholder="IAM user" value={iamUser} onChange={(event) => setIamUser(event.target.value)} />
                <Input placeholder="Region" value={region} onChange={(event) => setRegion(event.target.value)} />
                <Input placeholder="Access key ID" value={accessKeyId} onChange={(event) => setAccessKeyId(event.target.value)} />
                <Input type="password" placeholder="Secret access key" value={secretAccessKey} onChange={(event) => setSecretAccessKey(event.target.value)} />
              </>
            ) : (
              <>
                <Input placeholder="Host" value={host} onChange={(event) => setHost(event.target.value)} />
                <Input placeholder="Port" value={port} onChange={(event) => setPort(event.target.value)} />
                <Input placeholder="Database" value={database} onChange={(event) => setDatabase(event.target.value)} />
                <Input placeholder="Admin user" value={adminUser} onChange={(event) => setAdminUser(event.target.value)} />
                <Input type="password" placeholder="Admin password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} />
              </>
            )}
          </div>
          <SheetFooter>
            <Button onClick={() => void onCreate()} disabled={createPolicy.isPending}>
              Create policy
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete rotation policy?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.variable_key} will no longer rotate automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                deletePolicy.mutate(
                  { id: deleteTarget.id, appId },
                  {
                    onSuccess: () => {
                      toast.success("Policy deleted.");
                      setDeleteTarget(null);
                    },
                    onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed."),
                  },
                );
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

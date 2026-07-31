import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { RefreshCw, Workflow } from "lucide-react";

import {
  useCreateManualSyncRun,
  useSyncAuditEvents,
  useSyncRuns,
  type EnterpriseProvider,
  type SyncRun,
} from "../api/hooks";
import { isEnterpriseUiEnabled } from "../api/client";
import { Badge } from "@shell/components/ui/badge";
import { Button } from "@shell/components/ui/button";
import { cn, formatLastUsed } from "@shell/lib/utils";

const providerOptions = [
  { id: "all", label: "All providers" },
  { id: "github", label: "GitHub" },
  { id: "gitlab", label: "GitLab" },
  { id: "aws-ssm", label: "AWS SSM" },
  { id: "vercel", label: "Vercel" },
  { id: "google-secret-manager", label: "Google Secret Manager" },
] as const;

/**
 * Org-level sync diagnostics (absorbed from envsync-management-web).
 * Route: /organisation/sync
 */
export default function SyncOperations() {
  const enabled = isEnterpriseUiEnabled();
  const { data: syncRuns = [], isLoading, refetch, isFetching } = useSyncRuns();
  const createManual = useCreateManualSyncRun();

  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<SyncRun["status"] | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return syncRuns
      .filter((run) => {
        if (providerFilter !== "all" && run.provider_type !== providerFilter) return false;
        if (statusFilter !== "all" && run.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  }, [providerFilter, statusFilter, syncRuns]);

  const selected = useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const { data: events = [], isLoading: eventsLoading } = useSyncAuditEvents(selected?.id);

  const summary = useMemo(
    () => ({
      total: syncRuns.length,
      succeeded: syncRuns.filter((r) => r.status === "succeeded").length,
      failed: syncRuns.filter((r) => r.status === "failed").length,
      running: syncRuns.filter((r) => r.status === "running" || r.status === "pending").length,
    }),
    [syncRuns],
  );

  const onRetry = async (run: SyncRun) => {
    try {
      await createManual.mutateAsync({
        app_id: run.app_id ?? null,
        provider_type: run.provider_type as EnterpriseProvider,
        metadata: {
          ...(run.metadata ?? {}),
          source: "dashboard-retry",
          retry_of: run.id,
        },
      });
      toast.success("Sync retry queued");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    }
  };

  if (!enabled) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">Sync operations</h1>
        <p className="text-sm text-muted-foreground">Management API is not configured.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300/80">
            Enterprise
          </p>
          <h1 className="text-3xl font-semibold text-foreground flex items-center gap-2">
            <Workflow className="size-7" />
            Sync operations
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Inspect org-wide provider sync runs and audit trails. Project-scoped sync is also on each
            project&apos;s Integrations tab.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ["Total", summary.total],
            ["Succeeded", summary.succeeded],
            ["Failed", summary.failed],
            ["Running", summary.running],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card/50 px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">Provider</span>
          <select
            className="block rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value)}
          >
            {providerOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm space-y-1">
          <span className="text-muted-foreground">Status</span>
          <select
            className="block rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SyncRun["status"] | "all")}
          >
            <option value="all">all</option>
            <option value="pending">pending</option>
            <option value="running">running</option>
            <option value="succeeded">succeeded</option>
            <option value="failed">failed</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading sync runs…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {filtered.map((run) => (
              <button
                key={run.id}
                type="button"
                onClick={() => setSelectedId(run.id)}
                className={cn(
                  "w-full rounded-xl border border-border bg-card/40 p-4 text-left transition-colors hover:bg-muted/40",
                  selected?.id === run.id && "border-emerald-500/40 bg-emerald-500/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{run.provider_type}</strong>
                  <Badge variant="outline" className="text-xs">
                    {run.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatLastUsed(run.started_at)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {run.app_id ? (
                    <Link className="underline-offset-2 hover:underline" to={`/applications/${run.app_id}/integrations`}>
                      app {run.app_id.slice(0, 8)}…
                    </Link>
                  ) : (
                    "org-level"
                  )}
                </p>
                {run.error_message && (
                  <p className="mt-2 text-xs text-red-300 line-clamp-2">{run.error_message}</p>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">No sync runs match the filters.</p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-5 space-y-4 min-h-[280px]">
            {selected ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium">{selected.provider_type} detail</h2>
                    <p className="text-xs font-mono text-muted-foreground break-all">{selected.id}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={createManual.isPending}
                    onClick={() => void onRetry(selected)}
                  >
                    Retry run
                  </Button>
                </div>
                <div className="grid gap-1 text-sm">
                  <p>
                    Started: <strong>{new Date(selected.started_at).toLocaleString()}</strong>
                  </p>
                  <p>
                    Completed:{" "}
                    <strong>
                      {selected.completed_at
                        ? new Date(selected.completed_at).toLocaleString()
                        : "not completed"}
                    </strong>
                  </p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Audit events</h3>
                  {eventsLoading ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                  ) : events.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No audit events for this run.</p>
                  ) : (
                    events.map((event) => (
                      <div key={event.id} className="rounded-lg border border-border/60 p-3 text-xs space-y-1">
                        <div className="flex justify-between gap-2">
                          <strong>{event.action}</strong>
                          <Badge variant="outline">{event.result}</Badge>
                        </div>
                        <p className="text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
                        <pre className="overflow-x-auto rounded bg-muted/40 p-2 text-[11px]">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a sync run to inspect its audit trail.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

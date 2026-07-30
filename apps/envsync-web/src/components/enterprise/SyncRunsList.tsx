import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Play, RefreshCw } from "lucide-react";

import type { SyncRun } from "@/api/enterprise/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatLastUsed } from "@/lib/utils";

type SyncRunsListProps = {
  syncRuns: SyncRun[];
  onTriggerSync?: () => void;
  isTriggering?: boolean;
  basePath?: string;
};

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  succeeded: {
    label: "Success",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  failed: {
    label: "Failed",
    className:
      "border-red-500/30 bg-red-500/10 text-red-400",
  },
  pending: {
    label: "Pending",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  running: {
    label: "Running",
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-400",
  },
};

function computeDuration(startedAt: string, completedAt?: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffMs = end - start;

  if (diffMs < 1000) return `${diffMs}ms`;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  const remainingSec = diffSec % 60;
  return `${diffMin}m ${remainingSec}s`;
}

const providerLabels: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  "aws-ssm": "AWS SSM",
  vercel: "Vercel",
  "google-secret-manager": "GCP Secret Manager",
};

function formatProviderType(providerType: string): string {
  return providerLabels[providerType] ?? providerType;
}

export function SyncRunsList({
  syncRuns,
  onTriggerSync,
  isTriggering = false,
  basePath = "/enterprise/sync-runs",
}: SyncRunsListProps) {
  const sortedRuns = useMemo(
    () =>
      [...syncRuns].sort(
        (a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime(),
      ),
    [syncRuns],
  );

  return (
    <div className="rounded-xl border border-border bg-card/50">
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Sync Runs</h3>
          <p className="mt-1 text-xs text-tertiary">
            History of provider synchronization executions.
          </p>
        </div>
        {onTriggerSync && (
          <Button
            size="sm"
            onClick={onTriggerSync}
            disabled={isTriggering}
          >
            {isTriggering ? (
              <RefreshCw className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Trigger Sync
          </Button>
        )}
      </div>

      {sortedRuns.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-12">
          <RefreshCw className="size-8 text-zinc-600" />
          <p className="text-sm text-tertiary">No sync runs yet.</p>
          <p className="text-xs text-zinc-600">
            Trigger a sync to see execution history here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-t border-border text-xs text-tertiary">
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRuns.map((run) => {
                const config = statusConfig[run.status];
                const duration = computeDuration(
                  run.started_at,
                  run.completed_at,
                );

                return (
                  <tr
                    key={run.id}
                    className="border-t border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-foreground">
                        {formatProviderType(run.provider_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={cn("text-xs", config.className)}
                      >
                        {config.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatLastUsed(run.started_at)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {duration}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <Link to={`${basePath}/${run.id}`}>
                          View
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

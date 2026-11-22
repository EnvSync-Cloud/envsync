import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { Statistics } from "@/constants";

interface ApplicationsHeaderProps {
  statistics: Statistics;
  variableCount: number;
  secretCount: number;
  canEdit: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  onCreateProject: () => void;
}

export const ApplicationsHeader = ({
  statistics,
  variableCount,
  secretCount,
  canEdit,
  isRefetching,
  onRefresh,
  onCreateProject,
}: ApplicationsHeaderProps) => {
  const usage = [
    { label: "Projects", value: statistics.total },
    { label: "Variables", value: variableCount },
    { label: "Secrets", value: secretCount },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold text-foreground">Projects</h1>
          <span className="text-sm tabular-nums text-muted-foreground">{statistics.total}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onRefresh}
            variant="outline"
            size="icon"
            disabled={isRefetching}
            aria-label="Refresh projects"
          >
            <RefreshCw className={`size-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
          {canEdit && (
            <Button onClick={onCreateProject}>
              <Plus className="mr-2 size-4" />
              Create Project
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-border">
        {usage.map((item) => (
          <div key={item.label} className="border-border px-4 py-3 sm:border-l sm:first:border-l-0">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="mt-1 text-lg font-medium tabular-nums text-foreground">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

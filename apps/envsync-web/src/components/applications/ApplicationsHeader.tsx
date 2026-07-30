import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Database } from "lucide-react";
import { Statistics } from "@/constants";

interface ApplicationsHeaderProps {
  statistics: Statistics;
  canEdit: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  onCreateProject: () => void;
}

export const ApplicationsHeader = ({
  statistics,
  canEdit,
  isRefetching,
  onRefresh,
  onCreateProject,
}: ApplicationsHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-emerald-500/10 rounded-lg">
          <Database className="size-5 text-emerald-400" />
        </div>
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-medium text-foreground">Projects</h1>
            <div className="flex items-center space-x-2">
              <Badge
                variant="secondary"
                className="text-xs"
              >
                {statistics.total}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your environment configurations
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          disabled={isRefetching}
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`}
          />
        </Button>
        {canEdit && (
          <Button
            onClick={onCreateProject}
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Project
          </Button>
        )}
      </div>
    </div>
  );
};

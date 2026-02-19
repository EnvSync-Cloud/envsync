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
        <div className="p-2 bg-violet-500/10 rounded-lg">
          <Database className="size-5 text-violet-400" />
        </div>
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-xl font-semibold text-gray-100">Projects</h1>
            <div className="flex items-center space-x-2">
              <Badge
                variant="secondary"
                className="bg-gray-800 text-gray-400 text-xs"
              >
                {statistics.total}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage your environment configurations
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          className="text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-gray-200"
          disabled={isRefetching}
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`}
          />
        </Button>
        {canEdit && (
          <Button
            onClick={onCreateProject}
            className="bg-violet-500 hover:bg-violet-600 text-white"
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

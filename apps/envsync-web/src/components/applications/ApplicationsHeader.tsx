import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import { ApplicationStats } from "./ApplicationStats";
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
      <div>
        <h1 className="text-3xl font-bold text-white">Projects</h1>
        <p className="text-slate-400 mt-2">
          Manage your applications and their configurations
        </p>
        <ApplicationStats statistics={statistics} />
      </div>
      <div className="flex items-center space-x-3">
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          className="text-slate-400 border-slate-600 hover:bg-slate-700"
          disabled={isRefetching}
        >
          <RefreshCw
            className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`}
          />
        </Button>
        {canEdit && (
          <Button
            onClick={onCreateProject}
            className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Project
          </Button>
        )}
      </div>
    </div>
  );
};

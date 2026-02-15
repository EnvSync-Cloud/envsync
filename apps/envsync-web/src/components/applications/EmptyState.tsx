import { Button } from "@/components/ui/button";
import { Database, Plus } from "lucide-react";

interface EmptyStateProps {
  canEdit: boolean;
  onCreateProject: () => void;
}

export const EmptyState = ({ canEdit, onCreateProject }: EmptyStateProps) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-electric_indigo-400 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
          <Database className="w-8 h-8 text-white" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          No projects yet
        </h3>
        {canEdit && (
          <>
            <p className="text-slate-400 mb-6">
              Create your first project to start managing environment variables
              and configurations.
            </p>
            <Button
              onClick={onCreateProject}
              className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Project
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

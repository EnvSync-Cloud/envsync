import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Plus } from "lucide-react";

interface ApplicationsErrorPageProps {
  error: Error;
  onRetry: () => void;
  onCreateProject: () => void;
}

export const ApplicationsErrorPage = ({ 
  error, 
  onRetry, 
  onCreateProject 
}: ApplicationsErrorPageProps) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center space-y-4 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Failed to load projects</h3>
          <p className="text-slate-400 mb-4">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          <div className="flex space-x-2">
            <Button
              onClick={onRetry}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button
              onClick={onCreateProject}
              variant="outline"
              className="text-white border-slate-600 hover:bg-slate-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

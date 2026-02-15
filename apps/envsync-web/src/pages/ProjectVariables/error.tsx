import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

interface ProjectEnvironmentsErrorPageProps {
  error: Error;
  onRetry: () => void;
  onBack: () => void;
}

export const ProjectEnvironmentsErrorPage = ({
  error,
  onRetry,
  onBack,
}: ProjectEnvironmentsErrorPageProps) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center space-y-4 text-center max-w-md">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Failed to load project environments
          </h3>
          <p className="text-slate-400 mb-4">
            {error.message || "An unexpected error occurred while loading the project environments."}
          </p>
          <div className="flex items-center justify-center space-x-3">
            <Button
              onClick={onBack}
              variant="outline"
              className="text-white border-slate-600 hover:bg-slate-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
            <Button
              onClick={onRetry}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

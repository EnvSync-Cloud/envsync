import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ManageEnvironmentErrorPageProps {
  error: Error;
  onRetry: () => void;
}

export const ManageEnvironmentErrorPage = ({ 
  error, 
  onRetry 
}: ManageEnvironmentErrorPageProps) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center space-y-4 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Failed to load environment
          </h3>
          <p className="text-slate-400 mb-4">
            {error.message || "An unexpected error occurred"}
          </p>
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
  );
};

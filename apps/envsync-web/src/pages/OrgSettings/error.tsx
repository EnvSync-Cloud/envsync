import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface OrgSettingsErrorPageProps {
  error: Error;
  onRetry: () => void;
}

export const OrgSettingsErrorPage = ({
  error,
  onRetry,
}: OrgSettingsErrorPageProps) => {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <div className="flex flex-col items-center space-y-4 text-center">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Failed to load organization settings
          </h3>
          <p className="text-gray-400 mb-4">
            {error instanceof Error
              ? error.message
              : "An unexpected error occurred"}
          </p>
          <Button
            onClick={onRetry}
            className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
};

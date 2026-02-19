import { cn } from "@/lib/utils";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface PageErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryClassName?: string;
  fullScreen?: boolean;
  actions?: ReactNode;
  className?: string;
}

export const PageError = ({
  title = "Something went wrong",
  message = "An unexpected error occurred",
  onRetry,
  retryClassName = "bg-violet-500 hover:bg-violet-600 text-white",
  fullScreen = false,
  actions,
  className,
}: PageErrorProps) => {
  return (
    <div
      className={cn(
        "flex items-center justify-center",
        fullScreen ? "h-screen bg-gray-950" : "min-h-[60vh]",
        className
      )}
    >
      <div className="flex flex-col items-center space-y-4 text-center max-w-md">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-gray-400 mb-4">{message}</p>
          <div className="flex items-center justify-center space-x-3">
            {onRetry && (
              <Button onClick={onRetry} className={retryClassName}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
            {actions}
          </div>
        </div>
      </div>
    </div>
  );
};

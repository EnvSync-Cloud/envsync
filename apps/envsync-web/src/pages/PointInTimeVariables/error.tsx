import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PageError } from "@/components/ui/page-error";

interface PointInTimeErrorPageProps {
  error: Error;
  onRetry: () => void;
  onBack: () => void;
}

export const PointInTimeErrorPage = ({
  error,
  onRetry,
  onBack,
}: PointInTimeErrorPageProps) => (
  <PageError
    title="Failed to load point in time"
    message={error.message || "An unexpected error occurred while loading the point in time."}
    onRetry={onRetry}
    actions={
      <Button
        onClick={onBack}
        variant="outline"
        className="text-white border-gray-700 hover:bg-gray-800"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Point In Time
      </Button>
    }
  />
);

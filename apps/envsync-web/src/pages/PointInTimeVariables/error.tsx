import { Button } from "@/components/ui/button";
import { UpgradeEmptyState } from "@/components/UpgradeEmptyState";
import { ArrowLeft } from "lucide-react";
import { PageError } from "@/components/ui/page-error";
import { isPlanFeatureRequired } from "@/lib/plan";

interface PointInTimeErrorPageProps {
  error: Error;
  onRetry: () => void;
  onBack: () => void;
}

export const PointInTimeErrorPage = ({
  error,
  onRetry,
  onBack,
}: PointInTimeErrorPageProps) => {
  if (isPlanFeatureRequired(error)) {
    return (
      <div>
        <UpgradeEmptyState feature="point_in_time" title="Plan Upgrade required" />
        <div className="flex justify-center pb-10">
          <Button
            onClick={onBack}
            variant="outline"
            className="text-foreground border-border hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PageError
      title="Failed to load point in time"
      message={error.message || "An unexpected error occurred while loading the point in time."}
      onRetry={onRetry}
      actions={
        <Button
          onClick={onBack}
          variant="outline"
          className="text-foreground border-border hover:bg-muted"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Point In Time
        </Button>
      }
    />
  );
};

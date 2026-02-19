import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { PageError } from "@/components/ui/page-error";

interface ProjectEnvironmentsErrorPageProps {
  error: Error;
  onRetry: () => void;
  onBack: () => void;
}

export const ProjectEnvironmentsErrorPage = ({
  error,
  onRetry,
  onBack,
}: ProjectEnvironmentsErrorPageProps) => (
  <PageError
    title="Failed to load project environments"
    message={error.message || "An unexpected error occurred while loading the project environments."}
    onRetry={onRetry}
    actions={
      <Button
        onClick={onBack}
        variant="outline"
        className="text-white border-gray-700 hover:bg-gray-800"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Projects
      </Button>
    }
  />
);

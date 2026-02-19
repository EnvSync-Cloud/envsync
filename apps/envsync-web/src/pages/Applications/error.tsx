import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageError } from "@/components/ui/page-error";

interface ApplicationsErrorPageProps {
  error: Error;
  onRetry: () => void;
  onCreateProject: () => void;
}

export const ApplicationsErrorPage = ({
  error,
  onRetry,
  onCreateProject,
}: ApplicationsErrorPageProps) => (
  <PageError
    title="Failed to load projects"
    message={error instanceof Error ? error.message : "An unexpected error occurred"}
    onRetry={onRetry}
    actions={
      <Button
        onClick={onCreateProject}
        variant="outline"
        className="text-white border-gray-700 hover:bg-gray-800"
      >
        <Plus className="w-4 h-4 mr-2" />
        Create Project
      </Button>
    }
  />
);

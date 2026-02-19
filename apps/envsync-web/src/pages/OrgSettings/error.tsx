import { PageError } from "@/components/ui/page-error";

interface OrgSettingsErrorPageProps {
  error: Error;
  onRetry: () => void;
}

export const OrgSettingsErrorPage = ({
  error,
  onRetry,
}: OrgSettingsErrorPageProps) => (
  <PageError
    fullScreen
    title="Failed to load organization settings"
    message={error instanceof Error ? error.message : "An unexpected error occurred"}
    onRetry={onRetry}
  />
);

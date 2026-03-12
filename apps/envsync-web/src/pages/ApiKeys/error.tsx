import { api } from "@/api";
import { PageError } from "@/components/ui/page-error";

export const ApiKeysErrorPage = () => {
  const refreshApiKeys = api.apiKeys.refreshApiKeys();

  return (
    <PageError
      fullScreen
      title="Failed to load API keys"
      onRetry={refreshApiKeys}
      retryClassName="bg-violet-500 hover:bg-violet-600 text-white"
    />
  );
};

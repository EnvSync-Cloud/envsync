import { api } from "@/api";
import { PageError } from "@/components/ui/page-error";

export const ApiKeysErrorPage = () => (
  <PageError
    fullScreen
    title="Failed to load API keys"
    onRetry={api.apiKeys.refreshApiKeys}
    retryClassName="bg-indigo-500 hover:bg-indigo-600 text-white"
  />
);

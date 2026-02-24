import { api } from "@/api";
import { PageError } from "@/components/ui/page-error";

export const WebHooksErrorPage = () => {
  const refreshWebhooks = api.webhooks.refreshWebhooks();

  return (
    <PageError
      fullScreen
      title="Failed to load Webhooks"
      onRetry={refreshWebhooks}
      retryClassName="bg-indigo-500 hover:bg-indigo-600 text-white"
    />
  );
};

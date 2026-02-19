import { api } from "@/api";
import { PageError } from "@/components/ui/page-error";

export const WebHooksErrorPage = () => (
  <PageError
    fullScreen
    title="Failed to load Webhooks"
    onRetry={api.webhooks.refreshWebhooks}
    retryClassName="bg-indigo-500 hover:bg-indigo-600 text-white"
  />
);

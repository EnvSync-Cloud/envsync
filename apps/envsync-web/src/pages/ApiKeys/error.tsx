import { api } from "@/api";
import { Button } from "@/components/ui/button";

export const ApiKeysErrorPage = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <div className="flex flex-col items-center space-y-4">
        <div className="text-red-500 text-xl">⚠️</div>
        <p className="text-gray-400">Failed to load API keys</p>
        <Button
          onClick={api.apiKeys.refreshApiKeys}
          className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
        >
          Retry
        </Button>
      </div>
    </div>
  );
};

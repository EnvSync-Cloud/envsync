import { Button } from "@/components/ui/button";
import { RefreshCw, ShieldBan, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatLastUsed } from "@/lib/utils";
import { ApiKeyRowData } from "@/api/api-keys.api";
import { Function } from "@/utils/env";

interface ApiKeyRowProps {
  apiKey: ApiKeyRowData;
  isRegenerating: boolean;
  isUpdating: boolean;
  isLoading: boolean;
  isDeleting: boolean;
  handleRegenerateKey: Function<string>;
  handleToggleApiKey: (id: string, status: boolean) => unknown;
  handleDeleteApiKey: Function<string>;
}

export const ApiKeyRow = ({
  apiKey,
  isRegenerating,
  isLoading,
  isUpdating,
  isDeleting,
  handleRegenerateKey,
  handleToggleApiKey,
  handleDeleteApiKey,
}: ApiKeyRowProps) => {
  return (
    <tr key={apiKey.id} className="border-b border-gray-700 hover:bg-gray-750">
      <td className="py-4 px-4">
        <div className="flex flex-col">
          <span className="font-medium text-white">
            {apiKey.description || "Untitled"}
          </span>
          <span className="text-xs text-gray-400">ID: {apiKey.id}</span>
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center space-x-2">
          <code className="text-sm font-mono text-gray-300 bg-gray-900 px-2 py-1 rounded">
            {`${apiKey.key.substring(0, 8)}...${apiKey.key.substring(
              apiKey.key.length - 8
            )}`}
          </code>
          {/* <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
            onClick={() => copy.mutate(apiKey.key)}
          >
            <Copy className="h-3 w-3" />
          </Button> */}
        </div>
      </td>
      <td className="py-4 px-4">
        <Badge
          className={`${
            apiKey.is_active
              ? "bg-green-900 text-green-300 border-green-800"
              : "bg-gray-700 text-gray-300 border-gray-600"
          } border`}
        >
          {apiKey.is_active ? "Active" : "Inactive"}
        </Badge>
      </td>
      <td className="py-4 px-4">
        <span className="text-sm text-gray-400">
          {formatLastUsed(apiKey.last_used_at)}
        </span>
      </td>
      <td className="py-4 px-4">
        <span className="text-sm text-gray-400">
          {formatDate(apiKey.created_at)}
        </span>
      </td>
      <td className="py-4 px-4">
        <div className="flex flex-col">
          <span className="font-medium text-white">
            {apiKey.created_by?.name || "Unknown"}
          </span>
          <span className="text-xs text-gray-400">
            {apiKey.created_by?.email}
          </span>
        </div>
      </td>
      <td className="py-4 px-4">
        <div className="flex items-center justify-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRegenerateKey(apiKey.id)}
            disabled={isLoading || isRegenerating}
            className="text-white border-gray-600 hover:bg-gray-700"
            title="Regenerate API Key"
          >
            {isLoading ? (
              <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleToggleApiKey(apiKey.id, apiKey.is_active)}
            disabled={isLoading || isUpdating}
            className="text-white border-gray-600 hover:bg-gray-700"
            title={apiKey.is_active ? "Disable API Key" : "Enable API Key"}
          >
            {isLoading ? (
              <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : apiKey.is_active ? (
              <ShieldBan className="size-3" />
            ) : (
              <ShieldCheck className="size-3" />
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteApiKey(apiKey.id)}
            disabled={isLoading || isDeleting}
            className="text-red-400 border-red-600 hover:bg-red-900/20 hover:text-red-300"
            title="Delete API Key"
          >
            {isLoading ? (
              <div className="size-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="size-3" />
            )}
          </Button>
        </div>
      </td>
    </tr>
  );
};

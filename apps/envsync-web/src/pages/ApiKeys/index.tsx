import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Key, Copy } from "lucide-react";
import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/api";
import { toast } from "sonner";
import { useCopy } from "@/hooks/useClipboard";
import { Count } from "@/components/ui/count";
import { ApiKeyRow } from "@/components/api-keys/row";
import { EmptyApiKeys } from "./empty";

export const ApiKeys = () => {
  const copy = useCopy();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showCreatedKeyModalOpen, setShowCreatedKeyModalOpen] = useState(false);
  const [newKeyDescription, setNewKeyDescription] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  // Loading states for individual actions
  const [actionLoadingStates, setActionLoadingStates] = useState<
    Record<string, boolean>
  >({});

  // Helper function to set loading state for individual actions
  const setActionLoading = useCallback((keyId: string, loading: boolean) => {
    setActionLoadingStates((prev) => ({ ...prev, [keyId]: loading }));
  }, []);

  const { data: apiKeys, isLoading } = api.apiKeys.getApiKeys();

  const createApiKey = api.apiKeys.createApiKey({
    onSuccess: ({ data }) => {
      setCreatedKey(data.key);
      setNewKeyDescription("");
      setIsCreateModalOpen(false);
      setShowCreatedKeyModalOpen(true);
    },
    onError: () => {
      toast.error("Failed to create API key. Please try again.");
    },
  });

  const deleteApiKey = api.apiKeys.deleteApiKey({
    before: (apiKeyId) => {
      setActionLoading(apiKeyId, true);
    },
    onSuccess: ({ variables: apiKeyId }) => {
      setActionLoading(apiKeyId, false);
    },
    onError: ({ variables: apiKeyId }) => {
      toast("Failed to delete API key. Please try again.");
      setActionLoading(apiKeyId, false);
    },
  });

  const updateApiKey = api.apiKeys.updateApiKey({
    before: ({ apiKeyId }) => {
      setActionLoading(apiKeyId, true);
    },
    onSuccess: ({ variables: { apiKeyId } }) => {
      setActionLoading(apiKeyId, false);
      toast.success("API key updated successfully.");
    },
    onError: ({ variables: { apiKeyId } }) => {
      toast.error("Failed to update API key. Please try again.");
      setActionLoading(apiKeyId, false);
    },
  });

  const regenerateApiKey = api.apiKeys.regenerateApiKey({
    before: (apiKeyId) => {
      setActionLoading(apiKeyId, true);
    },
    onSuccess: ({ data, variables: apiKeyId }) => {
      setCreatedKey(data.newKey);
      setShowCreatedKeyModalOpen(true);
      setActionLoading(apiKeyId, false);
    },
    onError: ({ variables: apiKeyId }) => {
      toast.error("Failed to regenerate API key. Please try again.");
      setActionLoading(apiKeyId, false);
    },
  });

  // Action handlers
  const handleCreateKey = useCallback(() => {
    if (createApiKey.isPending) return;
    createApiKey.mutate(newKeyDescription);
  }, [newKeyDescription, createApiKey]);

  const handleDeleteApiKey = useCallback(
    (apiKeyId: string) => {
      if (actionLoadingStates[apiKeyId] || deleteApiKey.isPending) return;

      if (
        window.confirm(
          "Are you sure you want to delete this API key? This action cannot be undone."
        )
      ) {
        deleteApiKey.mutate(apiKeyId);
      }
    },
    [actionLoadingStates, deleteApiKey]
  );

  const handleRegenerateKey = useCallback(
    (apiKeyId: string) => {
      if (actionLoadingStates[apiKeyId] || regenerateApiKey.isPending) return;
      regenerateApiKey.mutate(apiKeyId);
    },
    [actionLoadingStates, regenerateApiKey]
  );

  const handleToggleApiKey = useCallback(
    (apiKeyId: string, isActive: boolean) => {
      if (actionLoadingStates[apiKeyId] || updateApiKey.isPending) return;

      updateApiKey.mutate({
        apiKeyId,
        updateData: { is_active: !isActive },
      });
    },
    [actionLoadingStates, updateApiKey]
  );

  const isEmpty = !isLoading && apiKeys.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">API Keys</h1>
          <p className="text-gray-400 mt-2">
            Manage your API keys for accessing EnvSync services
          </p>
        </div>

        {/* Created Key Modal */}
        <Dialog
          open={showCreatedKeyModalOpen}
          onOpenChange={setShowCreatedKeyModalOpen}
        >
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">API Key Created</DialogTitle>
              <DialogDescription className="text-gray-400">
                Your new API key has been created successfully. Make sure to
                copy it as you won't be able to see it again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white">API Key</Label>
                <div className="relative">
                  <Textarea
                    readOnly
                    value={createdKey || ""}
                    className="bg-gray-900 border-gray-700 text-white pr-12"
                    rows={3}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 h-8 w-8 p-0"
                    onClick={() => copy.mutate(createdKey || "")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreatedKeyModalOpen(false)}
                className="text-white border-gray-600 hover:bg-gray-700"
              >
                Close
              </Button>
              <Button
                onClick={() => copy.mutate(createdKey || "")}
                className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create API Key Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
              disabled={createApiKey.isPending}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">
                Create New API Key
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new API key for your organization. Make sure to copy it
                as you won't be able to see it again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description" className="text-white">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Enter a description for this API key..."
                  value={newKeyDescription}
                  onChange={(e) => setNewKeyDescription(e.target.value)}
                  className="bg-gray-900 border-gray-700 text-white"
                  disabled={createApiKey.isPending}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-white border-gray-600 hover:bg-gray-700"
                disabled={createApiKey.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateKey}
                className="bg-electric_indigo-500 hover:bg-electric_indigo-600 text-white"
                disabled={createApiKey.isPending}
              >
                {createApiKey.isPending ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Key"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Key className="size-8 mr-3 bg-electric_indigo-400 border border-electric_indigo-600 p-2 stroke-[3] text-white rounded-md" />
            API Keys
            <Count
              count={apiKeys?.length}
              size="xl"
              variant="subtle"
              className="ml-2"
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <EmptyApiKeys
              isCreatingApiKey={createApiKey.isPending}
              setIsCreateModalOpen={setIsCreateModalOpen}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    {[
                      "Description",
                      "API Key",
                      "Status",
                      "Last Used",
                      "Created",
                      "Created by",
                    ].map((header) => (
                      <th
                        key={header}
                        className="text-left py-3 px-4 text-gray-400 font-medium"
                      >
                        {header}
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 text-gray-400 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 6 }, (_, index) => (
                        <tr key={index} className="animate-pulse">
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-700 rounded w-3/4" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-700 rounded w-full" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-700 rounded w-1/2" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-700 rounded w-1/3" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-700 rounded w-1/3" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-gray-700 rounded w-full" />
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="h-6 bg-gray-700 rounded w-full" />
                          </td>
                        </tr>
                      ))
                    : apiKeys.map((apiKey) => (
                        <ApiKeyRow
                          key={apiKey.id}
                          apiKey={apiKey}
                          isRegenerating={regenerateApiKey.isPending}
                          isLoading={actionLoadingStates[apiKey.id]}
                          isUpdating={updateApiKey.isPending}
                          isDeleting={deleteApiKey.isPending}
                          handleRegenerateKey={handleRegenerateKey}
                          handleToggleApiKey={handleToggleApiKey}
                          handleDeleteApiKey={handleDeleteApiKey}
                        />
                      ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ApiKeys;

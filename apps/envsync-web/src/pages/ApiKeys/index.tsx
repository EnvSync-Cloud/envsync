import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Key, Copy } from "lucide-react";
import { useState, useCallback } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { PageShell } from "@/components/PageShell";
import { PageError } from "@/components/ui/page-error";

export const ApiKeys = () => {
  const copy = useCopy();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showCreatedKeyModalOpen, setShowCreatedKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyDescription, setNewKeyDescription] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [createdKeyMode, setCreatedKeyMode] = useState<"created" | "rotated">("created");
  const [pendingRotateId, setPendingRotateId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [actionLoadingStates, setActionLoadingStates] = useState<
    Record<string, boolean>
  >({});

  const setActionLoading = useCallback((keyId: string, loading: boolean) => {
    setActionLoadingStates((prev) => ({ ...prev, [keyId]: loading }));
  }, []);

  const { data: apiKeys, isLoading, error: apiKeysError, refetch: refetchApiKeys } = api.apiKeys.getApiKeys();

  const createApiKey = api.apiKeys.createApiKey({
    onSuccess: ({ data }) => {
      setCreatedKey(data.key);
      setCreatedKeyMode("created");
      setNewKeyName("");
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
      setPendingDeleteId(null);
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
      setCreatedKeyMode("rotated");
      setPendingRotateId(null);
      setShowCreatedKeyModalOpen(true);
      setActionLoading(apiKeyId, false);
    },
    onError: ({ variables: apiKeyId }) => {
      toast.error("Failed to regenerate API key. Please try again.");
      setActionLoading(apiKeyId, false);
    },
  });

  const handleCreateKey = useCallback(() => {
    if (createApiKey.isPending) return;
    if (!newKeyName.trim()) {
      toast.error("Name is required.");
      return;
    }
    createApiKey.mutate({
      name: newKeyName.trim(),
      description: newKeyDescription.trim() || undefined,
    });
  }, [newKeyName, newKeyDescription, createApiKey]);

  const handleDeleteApiKey = useCallback(
    (apiKeyId: string) => {
      if (actionLoadingStates[apiKeyId] || deleteApiKey.isPending) return;
      setPendingDeleteId(apiKeyId);
    },
    [actionLoadingStates, deleteApiKey]
  );

  const handleRegenerateKey = useCallback(
    (apiKeyId: string) => {
      if (actionLoadingStates[apiKeyId] || regenerateApiKey.isPending) return;
      setPendingRotateId(apiKeyId);
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

  const isEmpty = !isLoading && !apiKeysError && apiKeys.length === 0;

  if (apiKeysError) {
    return (
      <PageError
        title="Failed to load API keys"
        message={apiKeysError instanceof Error ? apiKeysError.message : "An unexpected error occurred"}
        onRetry={() => refetchApiKeys()}
      />
    );
  }

  return (
    <div className="animate-page-enter space-y-6">
      <PageShell
        title="API Keys"
        description="Manage your API keys for accessing EnvSync services"
        icon={Key}
      >
        {/* Created Key Modal */}
        <Dialog
          open={showCreatedKeyModalOpen}
          onOpenChange={setShowCreatedKeyModalOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {createdKeyMode === "rotated" ? "API Key Rotated" : "API Key Created"}
              </DialogTitle>
              <DialogDescription>
                {createdKeyMode === "rotated"
                  ? "The previous value no longer works. Copy the new key — it is shown only once."
                  : "Your new API key has been created. Copy it — you won't be able to see it again."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="relative">
                  <Textarea
                    readOnly
                    value={createdKey || ""}
                    className="hdx-block pr-12"
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
              >
                Done
              </Button>
              <Button
                onClick={() => copy.mutate(createdKey || "")}
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
              disabled={createApiKey.isPending}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Create New API Key
              </DialogTitle>
              <DialogDescription>
                Create a new API key for your organization. Make sure to copy it
                as you won't be able to see it again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key-name">
                  Name *
                </Label>
                <Input
                  id="api-key-name"
                  placeholder="Production API Key"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  disabled={createApiKey.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Optional description for this API key..."
                  value={newKeyDescription}
                  onChange={(e) => setNewKeyDescription(e.target.value)}
                  disabled={createApiKey.isPending}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={createApiKey.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateKey}
                disabled={createApiKey.isPending || !newKeyName.trim()}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Key className="size-8 mr-3 bg-emerald-400 border border-emerald-600 p-2 stroke-[3] text-white rounded-md" />
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
                  <tr className="border-b border-border">
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
                        className="text-left py-3 px-4 text-muted-foreground font-medium"
                      >
                        {header}
                      </th>
                    ))}
                    <th className="text-right py-3 px-4 text-muted-foreground font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 6 }, (_, index) => (
                        <tr key={index} className="animate-pulse">
                          <td className="py-4 px-4">
                            <div className="h-4 bg-muted rounded w-3/4" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-muted rounded w-full" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-muted rounded w-1/2" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-muted rounded w-1/3" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-muted rounded w-1/3" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="h-4 bg-muted rounded w-full" />
                          </td>
                          <td className="py-4 px-4 text-right">
                            <div className="h-6 bg-muted rounded w-full" />
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

        <AlertDialog open={Boolean(pendingRotateId)} onOpenChange={(open) => !open && setPendingRotateId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rotate API key?</AlertDialogTitle>
              <AlertDialogDescription>
                The current secret stops working immediately. You will see the new value once.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => pendingRotateId && regenerateApiKey.mutate(pendingRotateId)}
              >
                Rotate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(pendingDeleteId)} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete API key?</AlertDialogTitle>
              <AlertDialogDescription>
                This cannot be undone. Anything using this key will fail.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => pendingDeleteId && deleteApiKey.mutate(pendingDeleteId)}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </PageShell>
    </div>
  );
};

export default ApiKeys;

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Webhook,
  ShieldBan,
  ShieldCheck,
  Trash2,
  GlobeLock,
  MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState, useCallback } from "react";
import { api } from "@/api";
import { toast } from "sonner";
import { useCopy } from "@/hooks/useClipboard";
import { cn, formatDate, formatLastUsed } from "@/lib/utils";
import { CreateWebhookRequest } from "@envsync-cloud/envsync-ts-sdk";
import { WEBHOOK_EVENT_CATEGORIES } from "@/constants";
import { Count } from "@/components/ui/count";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreateWebhookDialog,
  WEBHOOK_TYPES,
  type WebhookFormData,
} from "@/components/webhooks/CreateWebhookDialog";

// Webhook event types
const WEBHOOK_EVENTS = [
  { value: "env.created", label: "Variable Created" },
  { value: "env.updated", label: "Variable Updated" },
  { value: "env.deleted", label: "Variable Deleted" },
  { value: "project.created", label: "Project Created" },
  { value: "project.updated", label: "Project Updated" },
  { value: "project.deleted", label: "Project Deleted" },
  { value: "deployment.started", label: "Deployment Started" },
  { value: "deployment.completed", label: "Deployment Completed" },
  { value: "deployment.failed", label: "Deployment Failed" },
];

export const WebHooks = () => {
  const copy = useCopy();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWebhookData, setNewWebhookData] = useState<WebhookFormData>({
    name: "",
    event_types: [],
    url: "",
    webhook_type: "CUSTOM",
    app_id: null,
    linked_to: "org",
  });

  // Loading states for individual actions
  const [actionLoadingStates, setActionLoadingStates] = useState<
    Record<string, boolean>
  >({});

  // Helper function to set loading state for individual actions
  const setActionLoading = useCallback(
    (webhookId: string, loading: boolean) => {
      setActionLoadingStates((prev) => ({ ...prev, [webhookId]: loading }));
    },
    []
  );

  const getWebhookTypeIcon = useCallback((type: string) => {
    const commonClassname = "size-3";

    switch (type) {
      case "SLACK":
      case "DISCORD":
        return <MessageCircle className={commonClassname} />;
      default:
        return <GlobeLock className={commonClassname} />;
    }
  }, []);

  // Move ALL hooks to the top level - no conditional hooks
  const { data: webhooks, isLoading, error } = api.webhooks.getWebhooks();

  // Always call this hook, but we'll only use the data when needed
  const {
    data: applications,
    isLoading: applicationsLoading,
    error: applicationsError,
  } = api.applications.allApplications();

  const createWebhook = api.webhooks.createWebhook({
    onSuccess: ({ data }) => {
      setNewWebhookData({
        name: "",
        event_types: [],
        url: "",
        webhook_type: "CUSTOM",
        app_id: null,
        linked_to: "org",
      });
      setIsCreateModalOpen(false);
      toast.success("Webhook created successfully!");
    },
    onError: () => {
      toast.error("Failed to create webhook. Please try again.");
    },
  });

  const deleteWebhook = api.webhooks.deleteWebhook({
    before: (webhookId) => {
      setActionLoading(webhookId, true);
    },
    onSuccess: ({ variables: webhookId }) => {
      setActionLoading(webhookId, false);
      toast.success("Webhook deleted successfully!");
    },
    onError: ({ variables: webhookId }) => {
      toast.error("Failed to delete webhook. Please try again.");
      setActionLoading(webhookId, false);
    },
  });

  const updateWebhook = api.webhooks.updateWebhook({
    before: ({ webhookId }) => {
      setActionLoading(webhookId, true);
    },
    onSuccess: ({ variables: { webhookId } }) => {
      setActionLoading(webhookId, false);
      toast.success("Webhook updated successfully.");
    },
    onError: ({ variables: { webhookId } }) => {
      toast.error("Failed to update webhook. Please try again.");
      setActionLoading(webhookId, false);
    },
  });

  // Action handlers
  const handleCreateWebhook = useCallback(() => {
    if (createWebhook.isPending) return;

    if (!newWebhookData.name.trim() || !newWebhookData.url.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (newWebhookData.event_types.length === 0) {
      toast.error("Please select at least one event type.");
      return;
    }

    // Validate app_id is required when linked_to is "app"
    if (newWebhookData.linked_to === "app" && !newWebhookData.app_id) {
      toast.error("Please select an application.");
      return;
    }

    createWebhook.mutate({
      name: newWebhookData.name,
      event_types: newWebhookData.event_types,
      url: newWebhookData.url,
      webhook_type:
        newWebhookData.webhook_type as CreateWebhookRequest["webhook_type"],
      app_id: newWebhookData.app_id,
      linked_to: newWebhookData.linked_to as CreateWebhookRequest["linked_to"],
    });
  }, [newWebhookData, createWebhook]);

  const handleDeleteWebhook = useCallback(
    (webhookId: string) => {
      if (actionLoadingStates[webhookId] || deleteWebhook.isPending) return;

      if (
        window.confirm(
          "Are you sure you want to delete this webhook? This action cannot be undone."
        )
      ) {
        deleteWebhook.mutate(webhookId);
      }
    },
    [actionLoadingStates, deleteWebhook]
  );

  const handleToggleWebhook = useCallback(
    (webhookId: string, isActive: boolean) => {
      if (actionLoadingStates[webhookId] || updateWebhook.isPending) return;

      updateWebhook.mutate({
        webhookId,
        updateData: { is_active: !isActive },
      });
    },
    [actionLoadingStates, updateWebhook]
  );

  const handleEventToggle = useCallback((eventType: string) => {
    setNewWebhookData((prev) => ({
      ...prev,
      event_types: prev.event_types.includes(eventType)
        ? prev.event_types.filter((e) => e !== eventType)
        : [...prev.event_types, eventType],
    }));
  }, []);

  const handleCategoryToggle = useCallback(
    (categoryName: string) => {
      const category = WEBHOOK_EVENT_CATEGORIES.find(
        (cat) => cat.name === categoryName
      );
      if (!category) return;

      const categoryEventValues = category.events.map((event) => event.value);
      const allSelected = categoryEventValues.every((eventValue) =>
        newWebhookData.event_types.includes(eventValue)
      );

      if (allSelected) {
        setNewWebhookData((prev) => ({
          ...prev,
          event_types: prev.event_types.filter(
            (eventType) => !categoryEventValues.includes(eventType)
          ),
        }));
      } else {
        setNewWebhookData((prev) => ({
          ...prev,
          event_types: [
            ...new Set([...prev.event_types, ...categoryEventValues]),
          ],
        }));
      }
    },
    [newWebhookData.event_types]
  );

  const handleSubcategoryToggle = useCallback(
    (categoryName: string, subcategoryName: string) => {
      const category = WEBHOOK_EVENT_CATEGORIES.find(
        (cat) => cat.name === categoryName
      );
      if (!category) return;

      const subcategory = category.subcategories.find(
        (sub) => sub.name === subcategoryName
      );
      if (!subcategory) return;

      const subcategoryEventValues = subcategory.events.map(
        (event) => event.value
      );
      const allSelected = subcategoryEventValues.every((eventValue) =>
        newWebhookData.event_types.includes(eventValue)
      );

      if (allSelected) {
        setNewWebhookData((prev) => ({
          ...prev,
          event_types: prev.event_types.filter(
            (eventType) => !subcategoryEventValues.includes(eventType)
          ),
        }));
      } else {
        setNewWebhookData((prev) => ({
          ...prev,
          event_types: [
            ...new Set([...prev.event_types, ...subcategoryEventValues]),
          ],
        }));
      }
    },
    [newWebhookData.event_types]
  );

  const isEmpty = !isLoading && !webhooks.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Webhooks</h1>
          <p className="text-gray-400 mt-2">
            Manage webhooks to receive real-time notifications about events in
            your EnvSync projects
          </p>
        </div>

        <Button
          className="bg-indigo-500 hover:bg-indigo-600 text-white"
          disabled={createWebhook.isPending}
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Webhook
        </Button>

        <CreateWebhookDialog
          open={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          applications={applications || []}
          applicationsLoading={applicationsLoading}
          applicationsError={!!applicationsError}
          isCreating={createWebhook.isPending}
          webhookData={newWebhookData}
          onWebhookDataChange={setNewWebhookData}
          onEventToggle={handleEventToggle}
          onCategoryToggle={handleCategoryToggle}
          onSubcategoryToggle={handleSubcategoryToggle}
          onCreate={handleCreateWebhook}
        />
      </div>

      <Card className="bg-card text-card-foreground bg-gradient-to-br from-gray-900 to-gray-950 border-gray-800 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <Webhook className="size-8 mr-3 bg-indigo-400 border border-indigo-600 p-2 stroke-[3] text-white rounded-md" />
            Webhooks
            <Count
              className="ml-2"
              count={webhooks?.length}
              variant="subtle"
              size="xl"
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEmpty ? (
            <div className="text-center py-12 rounded-xl bg-gray-900/40 border border-dashed border-gray-700">
              <Webhook className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">
                No Webhooks
              </h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Create your first webhook to receive real-time notifications
                about events in your EnvSync projects. Webhooks allow you to
                integrate with external services and automate your workflows.
              </p>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-indigo-500 hover:bg-indigo-600 text-white"
                disabled={createWebhook.isPending}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Webhook
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    {[
                      "Name",
                      "URL",
                      "Type",
                      "Events",
                      "Status",
                      "Last Triggered",
                      "Created At",
                      "Created by",
                    ].map((header) => (
                      <th
                        key={header}
                        className="text-left text-nowrap py-3 px-4 text-gray-400 font-medium"
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
                        <tr key={index} className="border-b border-gray-700">
                          <td className="py-4 px-4">
                            <div className="flex flex-col gap-2">
                              <Skeleton className="h-5 w-36 bg-gray-700" />
                              <Skeleton className="h-3 w-24 bg-gray-700/70" />
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center">
                              <Skeleton className="h-8 w-32 bg-gray-700 rounded" />
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Skeleton className="h-6 w-24 bg-gray-700 rounded-full" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex gap-1">
                              <Skeleton className="h-5 w-16 bg-gray-700 rounded-full" />
                              <Skeleton className="h-5 w-16 bg-gray-700 rounded-full" />
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Skeleton className="h-6 w-16 bg-gray-700 rounded-full" />
                          </td>
                          <td className="py-4 px-4">
                            <Skeleton className="h-5 w-28 bg-gray-700" />
                          </td>
                          <td className="py-4 px-4">
                            <Skeleton className="h-5 w-28 bg-gray-700" />
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-col gap-1">
                              <Skeleton className="h-5 w-24 bg-gray-700" />
                              <Skeleton className="h-3 w-36 bg-gray-700/70" />
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-end space-x-2">
                              <Skeleton className="h-8 w-8 bg-gray-700 rounded-md" />
                              <Skeleton className="h-8 w-8 bg-gray-700 rounded-md" />
                            </div>
                          </td>
                        </tr>
                      ))
                    : webhooks?.map((webhook) => (
                        <tr
                          key={webhook.id}
                          className="border-b border-gray-700 hover:bg-gray-800"
                        >
                          <td className="py-4 px-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-white">
                                {webhook.name || "Untitled"}
                              </span>
                              <span className="text-xs text-gray-400 font-mono">
                                ID: {webhook.id}
                              </span>
                              <span className="text-xs text-gray-500 mt-1">
                                Linked to: {webhook.linked_to}
                                {webhook.app_id && (
                                  <>
                                    <br />
                                    App:{" "}
                                    {applications?.find(
                                      (app) => app.id === webhook.app_id
                                    )?.name || webhook.app_id}
                                  </>
                                )}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <code className="text-sm font-mono text-gray-300 bg-gray-900 px-2 py-1 rounded max-w-xs truncate">
                                {webhook.url.slice(0, 5) +
                                  "....." +
                                  webhook.url.slice(-5)}
                              </code>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs flex items-center gap-1 w-fit bg-indigo-900/20 text-white/60",
                                WEBHOOK_TYPES.find(
                                  (t) => t.value === webhook.webhook_type
                                )?.color
                              )}
                            >
                              {getWebhookTypeIcon(webhook.webhook_type)}
                              {WEBHOOK_TYPES.find(
                                (t) => t.value === webhook.webhook_type
                              )?.label || webhook.webhook_type}
                            </Badge>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-wrap gap-1">
                              {webhook.event_types?.slice(0, 2).map((event) => (
                                <Badge
                                  key={event}
                                  variant="secondary"
                                  className="text-xs bg-gray-700 text-gray-300"
                                >
                                  <div
                                    className={cn(
                                      "rounded-full size-2 mr-1",
                                      event.includes("view")
                                        ? "bg-indigo-500"
                                        : event.includes("create")
                                        ? "bg-violet-500"
                                        : event.includes("update")
                                        ? "bg-amber-500"
                                        : event.includes("delete")
                                        ? "bg-rose-500"
                                        : "bg-gray-500"
                                    )}
                                  />
                                  {WEBHOOK_EVENTS.find(
                                    (e) => e.value === event
                                  )?.label.split(" ")[0] || event}
                                </Badge>
                              ))}
                              {webhook.event_types?.length > 2 && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs bg-gray-700 text-gray-300"
                                >
                                  +{webhook.event_types.length - 2} more
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <Badge
                                className={`${
                                  webhook.is_active
                                    ? "bg-green-900 text-green-300 border-green-800"
                                    : "bg-gray-700 text-gray-300 border-gray-600"
                                } border`}
                              >
                                {webhook.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm text-gray-400">
                              {formatLastUsed(webhook.last_triggered_at)}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <span className="text-sm text-nowrap text-gray-400">
                              {formatDate(webhook.created_at)}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-col">
                              <span className="font-medium text-white">
                                {webhook.created_by?.name || "Unknown"}
                              </span>
                              <span className="text-xs text-gray-400">
                                {webhook.created_by?.email}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-end space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleToggleWebhook(
                                    webhook.id,
                                    webhook.is_active
                                  )
                                }
                                disabled={
                                  actionLoadingStates[webhook.id] ||
                                  updateWebhook.isPending
                                }
                                className="text-white border-gray-600 hover:bg-gray-700"
                                title={
                                  webhook.is_active
                                    ? "Disable Webhook"
                                    : "Enable Webhook"
                                }
                              >
                                {actionLoadingStates[webhook.id] ? (
                                  <div className="size-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : webhook.is_active ? (
                                  <ShieldBan className="size-3" />
                                ) : (
                                  <ShieldCheck className="size-3" />
                                )}
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteWebhook(webhook.id)}
                                disabled={
                                  actionLoadingStates[webhook.id] ||
                                  deleteWebhook.isPending
                                }
                                className="text-red-400 border-red-600 hover:bg-red-900/20 hover:text-red-300"
                                title="Delete Webhook"
                              >
                                {actionLoadingStates[webhook.id] ? (
                                  <div className="size-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Trash2 className="size-3" />
                                )}
                              </Button>
                            </div>
                          </td>
                        </tr>
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

export default WebHooks;

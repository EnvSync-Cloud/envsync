import { useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MutationOptions, sdk } from "./base";
import {
  UpdateWebhookRequest,
  WebhookResponse,
  CreateWebhookRequest,
} from "@envsync-cloud/envsync-ts-sdk";
import { API_KEYS } from "../constants";
import { useInvalidateQueries } from "@/hooks/useApi";

const useWebhooks = () => {
  return useQuery({
    queryKey: [API_KEYS.ALL_WEBHOOKS],
    queryFn: async () => {
      const [webhooksData, usersData] = await Promise.all([
        sdk.webhooks.getWebhooks(),
        sdk.users.getUsers(),
      ]);

      const usersMap = new Map(usersData.map((user) => [user.id, user]));

      return webhooksData.map((webhook) => ({
        ...webhook,
        created_by: {
          name: usersMap.get(webhook.user_id)?.full_name || "Unknown",
          email: usersMap.get(webhook.user_id)?.email || "Unknown",
        },
        last_triggered_at: webhook.last_triggered_at
          ? new Date(webhook.last_triggered_at)
          : null,
        created_at: new Date(webhook.created_at),
        updated_at: new Date(webhook.updated_at),
      }));
    },
    refetchInterval: 5 * 60 * 1000,
    retry: 3,
  });
};

/**
 *
 * Custom hook to create a new API key.
 * @param {Function<WebhookResponse>} [options.onSuccess] - Callback function to execute on successful API key creation.
 * @param {Function<Error>} [options.onError] - Callback function to execute on error during API key creation.
 */
const useCreateWebhook = ({
  onSuccess,
  onError,
}: MutationOptions<WebhookResponse, string> = {}) => {
  const { invalidateWebhooks } = useInvalidateQueries();

  return useMutation({
    mutationFn: async ({
      name,
      event_types = [],
      url,
      webhook_type,
      app_id = null,
      linked_to = null,
    }: {
      name: string;
      event_types: string[];
      url: string;
      webhook_type: CreateWebhookRequest.webhook_type;
      app_id?: string | null;
      linked_to: CreateWebhookRequest.linked_to;
    }) => {
      const data = await sdk.webhooks.createWebhook({
        name,
        event_types,
        url,
        webhook_type,
        app_id,
        linked_to,
      });
      return data;
    },
    onSuccess: (data) => {
      onSuccess?.({ data });
      invalidateWebhooks();
    },
    onError: (error) => {
      console.error("Failed to create webhook:", error);
      onError?.({ error });
    },
  });
};

/**
 *
 * Custom hook to delete an API key.
 * @param {Function<WebhookResponse>} [options.onSuccess] - Callback function to execute on successful API key deletion.
 * @param {Function<Error>} [options.onError] - Callback function to execute on error during API key deletion.
 * @param {Function<string>} [options.before] - Callback function to execute before the API key deletion.
 */
const useDeleteWebhook = ({
  before,
  onSuccess,
  onError,
}: MutationOptions<WebhookResponse, string> = {}) => {
  const { invalidateWebhooks } = useInvalidateQueries();

  return useMutation({
    mutationFn: async (webhookId: string) => {
      before?.(webhookId);

      return await sdk.webhooks.deleteWebhook(webhookId);
    },
    onSuccess: (data, variables) => {
      invalidateWebhooks();
      onSuccess?.({ data, variables });
    },
    onError: (error, variables) => {
      console.error("Failed to delete API key:", error);
      onError?.({ error, variables });
    },
  });
};

export interface UpdateWebhookMutationVariables {
  webhookId: string;
  updateData: UpdateWebhookRequest;
}

/**
 *
 * Custom hook to update an existing API key.
 */
const useUpdateWebhook = ({
  before,
  onSuccess,
  onError,
}: MutationOptions<WebhookResponse, UpdateWebhookMutationVariables>) => {
  const { invalidateWebhooks } = useInvalidateQueries();

  return useMutation({
    mutationFn: async ({
      webhookId,
      updateData,
    }: UpdateWebhookMutationVariables) => {
      before?.({ webhookId, updateData });
      return await sdk.webhooks.updateWebhook(webhookId, updateData);
    },
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateWebhooks();
    },
    onError: (error, variables) => {
      console.error("Failed to update webhook:", error);
      onError?.({ error, variables });
    },
  });
};

const useRefreshWebhooks = () => {
  const { invalidateWebhooks } = useInvalidateQueries();
  return useCallback(() => { invalidateWebhooks(); }, [invalidateWebhooks]);
};

export const webhooks = {
  getWebhooks: useWebhooks,
  createWebhook: useCreateWebhook,
  deleteWebhook: useDeleteWebhook,
  updateWebhook: useUpdateWebhook,
  refreshWebhooks: useRefreshWebhooks,
};

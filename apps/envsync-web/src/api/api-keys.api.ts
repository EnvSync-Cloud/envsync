import { useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MutationOptions, sdk } from "./base";
import {
  ApiKeyResponse,
  RegenerateApiKeyResponse,
  UpdateApiKeyRequest,
} from "@envsync-cloud/envsync-ts-sdk";
import { API_KEYS } from "../constants";
import { useInvalidateQueries } from "@/hooks/useApi";

export type ApiKeyRowData = {
  created_by: {
    name: string;
    email: string;
  };
  last_used_at: Date;
  created_at: Date;
  updated_at: Date;
  id: string;
  user_id: string;
  org_id: string;
  description: string;
  is_active: boolean;
  key: string;
};

const useApiKeys = () => {
  return useQuery({
    queryKey: [API_KEYS.ALL_API_KEYS],
    queryFn: async () => {
      const [keysData, usersData] = await Promise.all([
        sdk.apiKeys.getAllApiKeys(),
        sdk.users.getUsers(),
      ]);

      const usersMap = new Map(usersData.map((user) => [user.id, user]));

      return keysData.map((key) => ({
        ...key,
        created_by: {
          name: usersMap.get(key.user_id)?.full_name || "Unknown",
          email: usersMap.get(key.user_id)?.email || "Unknown",
        },
        last_used_at: key.last_used_at ? new Date(key.last_used_at) : null,
        created_at: new Date(key.created_at),
        updated_at: new Date(key.updated_at),
      }));
    },
    refetchInterval: 5 * 60 * 1000,
    retry: 3,
  });
};

/**
 *
 * Custom hook to create a new API key.
 * @param {Function<ApiKeyResponse>} [options.onSuccess] - Callback function to execute on successful API key creation.
 * @param {Function<Error>} [options.onError] - Callback function to execute on error during API key creation.
 */
const useCreateApiKey = ({
  before,
  onSuccess,
  onError,
}: MutationOptions<ApiKeyResponse, string> = {}) => {
  const { invalidateApiKeys } = useInvalidateQueries();

  return useMutation({
    mutationFn: async (description: string) => {
      before?.(description);

      const data = await sdk.apiKeys.createApiKey({
        name: description || "Untitled API Key",
        description: description || null,
      });
      return data;
    },
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateApiKeys();
    },
    onError: (error, variables) => {
      console.error("Failed to create API key:", error);
      onError?.({ error, variables });
    },
  });
};

/**
 *
 * Custom hook to delete an API key.
 * @param {Function<ApiKeyResponse>} [options.onSuccess] - Callback function to execute on successful API key deletion.
 * @param {Function<Error>} [options.onError] - Callback function to execute on error during API key deletion.
 * @param {Function<string>} [options.before] - Callback function to execute before the API key deletion.
 */
const useDeleteApiKey = ({
  before,
  onSuccess,
  onError,
}: MutationOptions<ApiKeyResponse, string> = {}) => {
  const { invalidateApiKeys } = useInvalidateQueries();

  return useMutation({
    mutationFn: async (apiKeyId: string) => {
      before?.(apiKeyId);

      return await sdk.apiKeys.deleteApiKey(apiKeyId);
    },
    onSuccess: (data, variables) => {
      invalidateApiKeys();
      onSuccess?.({ data, variables });
    },
    onError: (error, variables) => {
      console.error("Failed to delete API key:", error);
      onError?.({ error, variables });
    },
  });
};

export interface UpdateApiKeyMutationVariables {
  apiKeyId: string;
  updateData: UpdateApiKeyRequest;
}

/**
 *
 * Custom hook to update an existing API key.
 */
const useUpdateApiKey = ({
  before,
  onSuccess,
  onError,
}: MutationOptions<ApiKeyResponse, UpdateApiKeyMutationVariables>) => {
  const { invalidateApiKeys } = useInvalidateQueries();

  return useMutation({
    mutationFn: async ({
      apiKeyId,
      updateData,
    }: UpdateApiKeyMutationVariables) => {
      before?.({ apiKeyId, updateData });
      return await sdk.apiKeys.updateApiKey(apiKeyId, updateData);
    },
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateApiKeys();
    },
    onError: (error, variables) => {
      console.error("Failed to update API key:", error);
      onError?.({ error, variables });
    },
  });
};

const useRegenerateApiKey = ({
  before,
  onSuccess,
  onError,
}: MutationOptions<RegenerateApiKeyResponse, string>) => {
  const { invalidateApiKeys } = useInvalidateQueries();

  return useMutation({
    mutationFn: async (apiKeyId: string) => {
      before?.(apiKeyId);
      return await sdk.apiKeys.regenerateApiKey(apiKeyId);
    },
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateApiKeys();
    },
    onError: (error, variables) => {
      console.error("Failed to regenerate API key:", error);
      onError?.({ error, variables });
    },
  });
};

const useRefreshApiKeys = () => {
  const { invalidateApiKeys } = useInvalidateQueries();
  return useCallback(() => { invalidateApiKeys(); }, [invalidateApiKeys]);
};

export const apiKeys = {
  getApiKeys: useApiKeys,
  createApiKey: useCreateApiKey,
  deleteApiKey: useDeleteApiKey,
  updateApiKey: useUpdateApiKey,
  regenerateApiKey: useRegenerateApiKey,
  refreshApiKeys: useRefreshApiKeys,
};

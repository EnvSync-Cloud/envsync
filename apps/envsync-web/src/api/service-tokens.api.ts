import { useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { API_KEYS } from "@/constants";
import { useInvalidateQueries } from "@/hooks/useApi";

import { apiRequest, type MutationOptions } from "./base";

export type ServiceTokenScope = {
  env_type_id?: string | null;
  path: string;
};

export type ServiceTokenPermissions = {
  read: boolean;
  write: boolean;
};

export type ServiceToken = {
  id: string;
  name: string;
  app_id: string | null;
  env_type_id: string | null;
  permissions: ServiceTokenPermissions;
  scopes: ServiceTokenScope[];
  rotated_from_id: string | null;
  grace_until: string | null;
  expires_at: string;
  last_used_at: string | null;
  created_at: string;
};

export type RevealedServiceToken = ServiceToken & {
  token: string;
};

export type CreateServiceTokenInput = {
  name: string;
  app_id: string;
  scopes: ServiceTokenScope[];
  permissions: ServiceTokenPermissions;
  expires_in_days: number;
};

export type RotateServiceTokenInput = {
  id: string;
  grace_hours?: number;
};

const useServiceTokens = (appId?: string, { enabled = true }: { enabled?: boolean } = {}) => {
  return useQuery({
    queryKey: [API_KEYS.ALL_SERVICE_TOKENS, appId],
    queryFn: async () => {
      const tokens = await apiRequest<ServiceToken[]>("/api/service_token");
      if (!appId) return tokens;
      return tokens.filter((token) => token.app_id === appId);
    },
    enabled: enabled && Boolean(appId),
    refetchInterval: 5 * 60 * 1000,
    retry: 3,
  });
};

const useCreateServiceToken = ({
  before,
  onSuccess,
  onError,
}: MutationOptions<RevealedServiceToken, CreateServiceTokenInput> = {}) => {
  const { invalidateServiceTokens } = useInvalidateQueries();

  return useMutation({
    mutationFn: async (input: CreateServiceTokenInput) => {
      before?.(input);
      return apiRequest<RevealedServiceToken>("/api/service_token", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },
    onSuccess: (data, variables) => {
      invalidateServiceTokens(variables.app_id);
      onSuccess?.({ data, variables });
    },
    onError: (error, variables) => {
      console.error("Failed to create service token:", error);
      onError?.({ error, variables });
    },
  });
};

const useRotateServiceToken = ({
  before,
  onSuccess,
  onError,
}: MutationOptions<RevealedServiceToken, RotateServiceTokenInput> = {}) => {
  const { invalidateServiceTokens } = useInvalidateQueries();

  return useMutation({
    mutationFn: async ({ id, grace_hours = 24 }: RotateServiceTokenInput) => {
      before?.({ id, grace_hours });
      return apiRequest<RevealedServiceToken>(`/api/service_token/${id}/rotate`, {
        method: "POST",
        body: JSON.stringify({ grace_hours }),
      });
    },
    onSuccess: (data, variables) => {
      invalidateServiceTokens(data.app_id ?? undefined);
      onSuccess?.({ data, variables });
    },
    onError: (error, variables) => {
      console.error("Failed to rotate service token:", error);
      onError?.({ error, variables });
    },
  });
};

const useDeleteServiceToken = ({
  before,
  onSuccess,
  onError,
}: MutationOptions<unknown, string> = {}) => {
  const { invalidateServiceTokens } = useInvalidateQueries();

  return useMutation({
    mutationFn: async (id: string) => {
      before?.(id);
      return apiRequest(`/api/service_token/${id}`, { method: "DELETE" });
    },
    onSuccess: (data, variables) => {
      invalidateServiceTokens();
      onSuccess?.({ data, variables });
    },
    onError: (error, variables) => {
      console.error("Failed to revoke service token:", error);
      onError?.({ error, variables });
    },
  });
};

const useRefreshServiceTokens = (appId?: string) => {
  const { invalidateServiceTokens } = useInvalidateQueries();
  return useCallback(() => {
    invalidateServiceTokens(appId);
  }, [appId, invalidateServiceTokens]);
};

export const serviceTokens = {
  getServiceTokens: useServiceTokens,
  createServiceToken: useCreateServiceToken,
  rotateServiceToken: useRotateServiceToken,
  deleteServiceToken: useDeleteServiceToken,
  refreshServiceTokens: useRefreshServiceTokens,
};

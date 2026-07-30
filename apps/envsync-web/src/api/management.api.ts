import { ApiError, CreateProviderConnectionRequest, EnvSyncManagementAPISDK, type ProviderConnection, type OrgSecret, type IntegrationBinding, type EnvTypeMapping, type SyncRun, type SyncAuditEvent } from "@envsync-cloud/envsync-management-ts-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { isReloginError, redirectToLogin } from "@/api/base";
import { runtimeConfig } from "@/utils/runtime-config";

export type EnterpriseProvider = "github" | "gitlab" | "aws-ssm" | "vercel" | "google-secret-manager";

function readCookie(name: string) {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function isUnsafeMethod(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function managementErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return String((error.body as { error?: string } | null)?.error || error.message || error.statusText || "Management request failed");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Management request failed";
}

function handleManagementError(error: unknown): never {
  if (isReloginError(error)) {
    void redirectToLogin();
  }
  throw new Error(managementErrorMessage(error));
}

export function getManagementSDK() {
  if (!runtimeConfig.managementApiUrl) {
    throw new Error("Management API URL is not configured.");
  }

  const resolveHeaders = async (options: { method: string }) => {
    if (!isUnsafeMethod(options.method)) return {};
    const csrfToken = readCookie("envsync_csrf");
    return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
  };

  return new EnvSyncManagementAPISDK({
    BASE: runtimeConfig.managementApiUrl,
    WITH_CREDENTIALS: true,
    CREDENTIALS: "include",
    HEADERS: resolveHeaders,
  });
}

export function useProviderConnections() {
  return useQuery({
    queryKey: ["management", "provider-connections"],
    queryFn: async () => {
      try {
        return await getManagementSDK().enterprise.listEnterpriseProviderConnections();
      } catch (error) {
        handleManagementError(error);
      }
    },
    enabled: Boolean(runtimeConfig.managementApiUrl),
  });
}

export function useCreateProviderConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      provider_type: EnterpriseProvider;
      name: string;
      status?: "active" | "inactive" | "error";
      auth_config?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }) => {
      try {
        return await getManagementSDK().enterprise.createEnterpriseProviderConnection({
          provider_type: payload.provider_type as CreateProviderConnectionRequest.provider_type,
          name: payload.name,
          status: payload.status as CreateProviderConnectionRequest.status | undefined,
          auth_config: payload.auth_config,
          metadata: payload.metadata,
        });
      } catch (error) {
        handleManagementError(error);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["management", "provider-connections"] });
    },
  });
}

export function useOrgSecrets() {
  return useQuery({
    queryKey: ["management", "org-secrets"],
    queryFn: async () => {
      try {
        return await getManagementSDK().enterprise.listEnterpriseOrgSecrets();
      } catch (error) {
        handleManagementError(error);
      }
    },
    enabled: Boolean(runtimeConfig.managementApiUrl),
  });
}

export function useCreateOrgSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      key: string;
      value: string;
      description?: string | null;
      metadata?: Record<string, unknown>;
    }) => {
      try {
        return await getManagementSDK().enterprise.createEnterpriseOrgSecret(payload);
      } catch (error) {
        handleManagementError(error);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["management", "org-secrets"] });
    },
  });
}

export function useIntegrationBindings(appId?: string) {
  return useQuery({
    queryKey: ["management", "bindings", appId],
    queryFn: async () => {
      if (!appId) {
        throw new Error("appId is required");
      }

      try {
        return await getManagementSDK().enterprise.listEnterpriseIntegrationBindings(appId);
      } catch (error) {
        handleManagementError(error);
      }
    },
    enabled: Boolean(runtimeConfig.managementApiUrl && appId),
  });
}

export function useCreateIntegrationBinding(appId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      provider_connection_id: string;
      provider_type: EnterpriseProvider;
      is_enabled?: boolean;
      metadata?: Record<string, unknown>;
    }) => {
      if (!appId) {
        throw new Error("appId is required");
      }

      try {
        return await getManagementSDK().enterprise.createEnterpriseIntegrationBinding(appId, {
          provider_connection_id: payload.provider_connection_id,
          provider_type: payload.provider_type as CreateProviderConnectionRequest.provider_type,
          is_enabled: payload.is_enabled,
          metadata: payload.metadata,
        });
      } catch (error) {
        handleManagementError(error);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["management", "bindings", appId] });
    },
  });
}

export function useUpdateIntegrationBinding(appId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      is_enabled?: boolean;
      metadata?: Record<string, unknown>;
    }) => {
      if (!appId) {
        throw new Error("appId is required");
      }

      try {
        return await getManagementSDK().enterprise.updateEnterpriseIntegrationBinding(appId, payload.id, {
          is_enabled: payload.is_enabled,
          metadata: payload.metadata,
        });
      } catch (error) {
        handleManagementError(error);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["management", "bindings", appId] });
    },
  });
}

export function useEnvTypeMappings(appId?: string) {
  return useQuery({
    queryKey: ["management", "env-type-mappings", appId],
    queryFn: async () => {
      if (!appId) {
        throw new Error("appId is required");
      }

      try {
        return await getManagementSDK().enterprise.listEnterpriseEnvTypeMappings(appId);
      } catch (error) {
        handleManagementError(error);
      }
    },
    enabled: Boolean(runtimeConfig.managementApiUrl && appId),
  });
}

export function useCreateEnvTypeMapping(appId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      env_type_id: string;
      integration_binding_id: string;
      target_identifier: string;
      branch_ref?: string | null;
      path_prefix?: string | null;
      metadata?: Record<string, unknown>;
    }) => {
      if (!appId) {
        throw new Error("appId is required");
      }

      try {
        return await getManagementSDK().enterprise.createEnterpriseEnvTypeMapping(appId, payload);
      } catch (error) {
        handleManagementError(error);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["management", "env-type-mappings", appId] });
    },
  });
}

export function useUpdateEnvTypeMapping(appId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      target_identifier?: string;
      branch_ref?: string | null;
      path_prefix?: string | null;
      metadata?: Record<string, unknown>;
    }) => {
      if (!appId) {
        throw new Error("appId is required");
      }

      try {
        return await getManagementSDK().enterprise.updateEnterpriseEnvTypeMapping(appId, payload.id, {
          target_identifier: payload.target_identifier,
          branch_ref: payload.branch_ref,
          path_prefix: payload.path_prefix,
          metadata: payload.metadata,
        });
      } catch (error) {
        handleManagementError(error);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["management", "env-type-mappings", appId] });
    },
  });
}

export function useSyncRuns(appId?: string) {
  return useQuery({
    queryKey: ["management", "sync-runs", appId],
    queryFn: async () => {
      try {
        const runs = await getManagementSDK().enterprise.listEnterpriseSyncRuns();
        return appId ? runs.filter((run) => run.app_id === appId) : runs;
      } catch (error) {
        handleManagementError(error);
      }
    },
    enabled: Boolean(runtimeConfig.managementApiUrl),
  });
}

export function useCreateManualSyncRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      app_id?: string | null;
      provider_type: EnterpriseProvider;
      metadata?: Record<string, unknown>;
    }) => {
      try {
        return await getManagementSDK().enterprise.createEnterpriseManualSyncRun({
          app_id: payload.app_id,
          provider_type: payload.provider_type as CreateProviderConnectionRequest.provider_type,
          metadata: payload.metadata,
        });
      } catch (error) {
        handleManagementError(error);
      }
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["management", "sync-runs"] });
      if (variables.app_id) {
        await queryClient.invalidateQueries({ queryKey: ["management", "sync-runs", variables.app_id] });
      }
    },
  });
}

export function useSyncAuditEvents(syncRunId?: string) {
  return useQuery({
    queryKey: ["management", "sync-audit-events", syncRunId],
    queryFn: async () => {
      if (!syncRunId) {
        throw new Error("syncRunId is required");
      }

      try {
        return await getManagementSDK().enterprise.listEnterpriseSyncAuditEvents(syncRunId);
      } catch (error) {
        handleManagementError(error);
      }
    },
    enabled: Boolean(runtimeConfig.managementApiUrl && syncRunId),
  });
}

export type {
  EnvTypeMapping,
  IntegrationBinding,
  OrgSecret,
  ProviderConnection,
  SyncAuditEvent,
  SyncRun,
};

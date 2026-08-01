import type {
  CreateOrgSecretRequest,
  CreateProviderConnectionRequest,
  UpdateOrgSecretRequest,
  UpdateProviderConnectionRequest,
} from "@envsync-cloud/envsync-ts-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { enterpriseErrorMessage, getEnterpriseSDK, isEnterpriseUiEnabled } from "./client";
import type {
  EnterpriseProvider,
  EnvTypeMapping,
  IntegrationBinding,
  OrgSecret,
  ProviderConnection,
  SyncAuditEvent,
  SyncRun,
} from "./types";

export async function listProviderConnections(): Promise<ProviderConnection[]> {
  try {
    return await getEnterpriseSDK().enterprise.listEnterpriseProviderConnections();
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export async function listOrgSecrets(): Promise<OrgSecret[]> {
  try {
    return await getEnterpriseSDK().enterprise.listEnterpriseOrgSecrets();
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export async function listIntegrationBindings(appId: string): Promise<IntegrationBinding[]> {
  try {
    return await getEnterpriseSDK().enterprise.listEnterpriseIntegrationBindings(appId);
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export async function listEnvTypeMappings(appId: string): Promise<EnvTypeMapping[]> {
  try {
    return await getEnterpriseSDK().enterprise.listEnterpriseEnvTypeMappings(appId);
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export async function listSyncRuns(): Promise<SyncRun[]> {
  try {
    return await getEnterpriseSDK().enterprise.listEnterpriseSyncRuns();
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export async function listSyncAuditEvents(syncRunId: string): Promise<SyncAuditEvent[]> {
  try {
    return await getEnterpriseSDK().enterprise.listEnterpriseSyncAuditEvents(syncRunId);
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export async function getManagementSystemStatus() {
  try {
    // Prefer manage surface path (enterprise install/license view).
    return await getEnterpriseSDK().system.manageGetManagementSystemStatus();
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export async function getLicenseStatus() {
  try {
    return await getEnterpriseSDK().license.getManagementLicenseStatus();
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export async function activateLicense() {
  try {
    return await getEnterpriseSDK().license.activateManagementLicense();
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export async function verifyLicense() {
  try {
    return await getEnterpriseSDK().license.verifyManagementLicense();
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export function useProviderConnections() {
  return useQuery({
    queryKey: ["enterprise", "provider-connections"],
    queryFn: listProviderConnections,
    enabled: isEnterpriseUiEnabled(),
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
        return await getEnterpriseSDK().enterprise.createEnterpriseProviderConnection({
          provider_type: payload.provider_type as CreateProviderConnectionRequest.provider_type,
          name: payload.name,
          status: payload.status as CreateProviderConnectionRequest.status | undefined,
          auth_config: payload.auth_config,
          metadata: payload.metadata,
        });
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "provider-connections"] });
    },
  });
}

export function useUpdateProviderConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      name?: string;
      status?: "active" | "inactive" | "error";
      auth_config?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }) => {
      try {
        return await getEnterpriseSDK().enterprise.updateEnterpriseProviderConnection(payload.id, {
          name: payload.name,
          status: payload.status as UpdateProviderConnectionRequest.status | undefined,
          auth_config: payload.auth_config,
          metadata: payload.metadata,
        });
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "provider-connections"] });
    },
  });
}

export function useOrgSecrets() {
  return useQuery({
    queryKey: ["enterprise", "org-secrets"],
    queryFn: listOrgSecrets,
    enabled: isEnterpriseUiEnabled(),
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
        return await getEnterpriseSDK().enterprise.createEnterpriseOrgSecret(
          payload as CreateOrgSecretRequest,
        );
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "org-secrets"] });
    },
  });
}

export function useUpdateOrgSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      value?: string;
      description?: string | null;
      metadata?: Record<string, unknown>;
    }) => {
      try {
        return await getEnterpriseSDK().enterprise.updateEnterpriseOrgSecret(payload.id, {
          value: payload.value,
          description: payload.description,
          metadata: payload.metadata,
        } as UpdateOrgSecretRequest);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "org-secrets"] });
    },
  });
}

export function useIntegrationBindings(appId?: string) {
  return useQuery({
    queryKey: ["enterprise", "bindings", appId],
    queryFn: async () => {
      if (!appId) throw new Error("appId is required");
      return listIntegrationBindings(appId);
    },
    enabled: isEnterpriseUiEnabled() && Boolean(appId),
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
      if (!appId) throw new Error("appId is required");
      try {
        return await getEnterpriseSDK().enterprise.createEnterpriseIntegrationBinding(appId, {
          provider_connection_id: payload.provider_connection_id,
          provider_type: payload.provider_type as CreateProviderConnectionRequest.provider_type,
          is_enabled: payload.is_enabled,
          metadata: payload.metadata,
        });
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "bindings", appId] });
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
      if (!appId) throw new Error("appId is required");
      try {
        return await getEnterpriseSDK().enterprise.updateEnterpriseIntegrationBinding(appId, payload.id, {
          is_enabled: payload.is_enabled,
          metadata: payload.metadata,
        });
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "bindings", appId] });
    },
  });
}

export function useEnvTypeMappings(appId?: string) {
  return useQuery({
    queryKey: ["enterprise", "env-type-mappings", appId],
    queryFn: async () => {
      if (!appId) throw new Error("appId is required");
      return listEnvTypeMappings(appId);
    },
    enabled: isEnterpriseUiEnabled() && Boolean(appId),
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
      if (!appId) throw new Error("appId is required");
      try {
        return await getEnterpriseSDK().enterprise.createEnterpriseEnvTypeMapping(appId, payload);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "env-type-mappings", appId] });
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
      if (!appId) throw new Error("appId is required");
      try {
        return await getEnterpriseSDK().enterprise.updateEnterpriseEnvTypeMapping(appId, payload.id, {
          target_identifier: payload.target_identifier,
          branch_ref: payload.branch_ref,
          path_prefix: payload.path_prefix,
          metadata: payload.metadata,
        });
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "env-type-mappings", appId] });
    },
  });
}

export function useSyncRuns(appId?: string) {
  return useQuery({
    queryKey: ["enterprise", "sync-runs", appId],
    queryFn: async () => {
      const runs = await listSyncRuns();
      return appId ? runs.filter((run) => run.app_id === appId) : runs;
    },
    enabled: isEnterpriseUiEnabled(),
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
        return await getEnterpriseSDK().enterprise.createEnterpriseManualSyncRun({
          app_id: payload.app_id,
          provider_type: payload.provider_type as CreateProviderConnectionRequest.provider_type,
          metadata: payload.metadata,
        });
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "sync-runs"] });
      if (variables.app_id) {
        await queryClient.invalidateQueries({ queryKey: ["enterprise", "sync-runs", variables.app_id] });
      }
    },
  });
}

export function useSyncAuditEvents(syncRunId?: string) {
  return useQuery({
    queryKey: ["enterprise", "sync-audit-events", syncRunId],
    queryFn: async () => {
      if (!syncRunId) throw new Error("syncRunId is required");
      return listSyncAuditEvents(syncRunId);
    },
    enabled: isEnterpriseUiEnabled() && Boolean(syncRunId),
  });
}

export function useManagementSystemStatus() {
  return useQuery({
    queryKey: ["enterprise", "system-status"],
    queryFn: getManagementSystemStatus,
    enabled: isEnterpriseUiEnabled(),
    refetchInterval: 60_000,
  });
}

export function useLicenseStatus() {
  return useQuery({
    queryKey: ["enterprise", "license-status"],
    queryFn: getLicenseStatus,
    enabled: isEnterpriseUiEnabled(),
  });
}

export function useActivateLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activateLicense,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "license-status"] });
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "system-status"] });
    },
  });
}

export function useVerifyLicense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: verifyLicense,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "license-status"] });
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "system-status"] });
    },
  });
}

export type {
  EnterpriseProvider,
  EnvTypeMapping,
  IntegrationBinding,
  OrgSecret,
  ProviderConnection,
  SyncAuditEvent,
  SyncRun,
};

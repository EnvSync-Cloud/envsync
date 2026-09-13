import type {
  CreateOrgKmsCredentialRequest,
  CreateOrgSecretRequest,
  CreateProviderConnectionRequest,
  CreateSamlProviderRequest,
  UpdateOrgKmsConfigRequest,
  UpdateOrgSecretRequest,
  UpdateProviderConnectionRequest,
  UpdateSamlProviderRequest,
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

export async function listSamlProviders() {
  try {
    return await getEnterpriseSDK().samlProviders.getAllSamlProviders();
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export function useSamlProviders() {
  return useQuery({
    queryKey: ["enterprise", "saml-providers"],
    queryFn: listSamlProviders,
    enabled: isEnterpriseUiEnabled(),
  });
}

export function useCreateSamlProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSamlProviderRequest) => {
      try {
        return await getEnterpriseSDK().samlProviders.createSamlProvider(payload);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "saml-providers"] });
    },
  });
}

export function useUpdateSamlProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string } & UpdateSamlProviderRequest) => {
      const { id, ...body } = payload;
      try {
        return await getEnterpriseSDK().samlProviders.updateSamlProvider(id, body);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "saml-providers"] });
    },
  });
}

export function useDeleteSamlProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await getEnterpriseSDK().samlProviders.deleteSamlProvider(id);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "saml-providers"] });
    },
  });
}

export async function getPublicSpMetadata(orgId: string) {
  try {
    return await getEnterpriseSDK().samlSso.getPublicSamlMetadata(orgId);
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export function useSpMetadata(orgId?: string) {
  return useQuery({
    queryKey: ["enterprise", "saml-sp-metadata", orgId],
    queryFn: async () => {
      if (!orgId) throw new Error("orgId is required");
      return getPublicSpMetadata(orgId);
    },
    enabled: isEnterpriseUiEnabled() && Boolean(orgId),
  });
}

export function useDownloadSpMetadata() {
  return useMutation({
    mutationFn: getPublicSpMetadata,
  });
}

export function useStartSamlTestLogin() {
  return useMutation({
    mutationFn: async (payload: { orgSlug: string; providerId: string }) => {
      try {
        return await getEnterpriseSDK().samlSso.startPublicSamlSso(payload.orgSlug, {
          provider_id: payload.providerId,
        });
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
  });
}

const kmsConfigKey = ["enterprise", "kms", "config"] as const;
const kmsAppsKey = ["enterprise", "kms", "apps"] as const;
// Break-glass detach is platform-token only; do not add an org-UI hook.

export async function getOrgKmsConfig() {
  try {
    return await getEnterpriseSDK().enterpriseCmk.getOrgKmsConfig();
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export async function getOrgKmsJob(id: string) {
  try {
    return await getEnterpriseSDK().enterpriseCmk.getOrgKmsJob(id);
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export async function listOrgKmsApps() {
  try {
    return await getEnterpriseSDK().enterpriseCmk.listOrgKmsApps();
  } catch (error) {
    throw new Error(enterpriseErrorMessage(error));
  }
}

export function useOrgKmsConfig() {
  return useQuery({
    queryKey: kmsConfigKey,
    queryFn: getOrgKmsConfig,
    enabled: isEnterpriseUiEnabled(),
    refetchInterval: query => (query.state.data?.status === "rotating" ? 3_000 : false),
  });
}

export function useOrgKmsApps() {
  return useQuery({
    queryKey: kmsAppsKey,
    queryFn: listOrgKmsApps,
    enabled: isEnterpriseUiEnabled(),
  });
}

export function useOrgKmsJob(jobId?: string | null) {
  return useQuery({
    queryKey: ["enterprise", "kms", "job", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("jobId is required");
      return getOrgKmsJob(jobId);
    },
    enabled: isEnterpriseUiEnabled() && Boolean(jobId),
    refetchInterval: query => {
      const status = query.state.data?.status;
      return status === "pending" || status === "running" ? 2_000 : false;
    },
  });
}

export function useUpdateOrgKmsConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateOrgKmsConfigRequest) => {
      try {
        return await getEnterpriseSDK().enterpriseCmk.updateOrgKmsConfig(payload);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "kms"] });
    },
  });
}

export function useCreateOrgKmsCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateOrgKmsCredentialRequest) => {
      try {
        return await getEnterpriseSDK().enterpriseCmk.createOrgKmsCredential(payload);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: kmsConfigKey });
    },
  });
}

export function useVerifyOrgKms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        return await getEnterpriseSDK().enterpriseCmk.verifyOrgKms();
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: kmsConfigKey });
    },
  });
}

export function useRotateOrgKmsKek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        return await getEnterpriseSDK().enterpriseCmk.rotateOrgKmsKek();
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "kms"] });
    },
  });
}

export function useAttachOrgKms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        return await getEnterpriseSDK().enterpriseCmk.attachOrgKms();
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "kms"] });
    },
  });
}

export function useDetachOrgKms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        return await getEnterpriseSDK().enterpriseCmk.detachOrgKms();
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "kms"] });
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

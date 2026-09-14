import type {
  CreateDynamicSecretEngineRequest,
  CreateDynamicSecretLeaseRequest,
  CreateLogForwardingRequest,
  CreateOidcProviderRequest,
  CreateRotationPolicyRequest,
  UpdateDynamicSecretEngineRequest,
  UpdateOidcProviderRequest,
  UpdateRotationPolicyRequest,
} from "@envsync-cloud/envsync-ts-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { enterpriseErrorMessage, getEnterpriseSDK, isEnterpriseUiEnabled } from "./client";

export function useOidcProviders() {
  return useQuery({
    queryKey: ["enterprise", "oidc-providers"],
    queryFn: async () => {
      try {
        return await getEnterpriseSDK().oidcProviders.getAllOidcProviders();
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    enabled: isEnterpriseUiEnabled(),
  });
}

export function useCreateOidcProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateOidcProviderRequest) => {
      try {
        return await getEnterpriseSDK().oidcProviders.createOidcProvider(payload);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "oidc-providers"] });
    },
  });
}

export function useUpdateOidcProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string } & UpdateOidcProviderRequest) => {
      try {
        const { id, ...body } = payload;
        return await getEnterpriseSDK().oidcProviders.updateOidcProvider(id, body);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "oidc-providers"] });
    },
  });
}

export function useDeleteOidcProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await getEnterpriseSDK().oidcProviders.deleteOidcProvider(id);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "oidc-providers"] });
    },
  });
}

export function useRotationPolicies(appId?: string) {
  return useQuery({
    queryKey: ["enterprise", "rotation-policies", appId],
    queryFn: async () => {
      try {
        return await getEnterpriseSDK().rotation.getRotationPolicies(appId);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    enabled: isEnterpriseUiEnabled() && Boolean(appId),
  });
}

export function useCreateRotationPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRotationPolicyRequest) => {
      try {
        return await getEnterpriseSDK().rotation.createRotationPolicy(payload);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["enterprise", "rotation-policies", variables.app_id],
      });
    },
  });
}

export function useUpdateRotationPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; appId: string } & UpdateRotationPolicyRequest) => {
      try {
        const { id, appId: _appId, ...body } = payload;
        return await getEnterpriseSDK().rotation.updateRotationPolicy(id, body);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["enterprise", "rotation-policies", variables.appId],
      });
    },
  });
}

export function useDeleteRotationPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; appId: string }) => {
      try {
        return await getEnterpriseSDK().rotation.deleteRotationPolicy(payload.id);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["enterprise", "rotation-policies", variables.appId],
      });
    },
  });
}

export function useTriggerRotation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; appId: string }) => {
      try {
        return await getEnterpriseSDK().rotation.triggerRotation(payload.id);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["enterprise", "rotation-policies", variables.appId],
      });
    },
  });
}

export function useDynamicSecretEngines() {
  return useQuery({
    queryKey: ["enterprise", "dynamic-secret-engines"],
    queryFn: async () => {
      try {
        return await getEnterpriseSDK().dynamicSecrets.getAllDynamicSecretEngines();
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    enabled: isEnterpriseUiEnabled(),
  });
}

export function useCreateDynamicSecretEngine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateDynamicSecretEngineRequest) => {
      try {
        return await getEnterpriseSDK().dynamicSecrets.createDynamicSecretEngine(payload);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "dynamic-secret-engines"] });
    },
  });
}

export function useUpdateDynamicSecretEngine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string } & UpdateDynamicSecretEngineRequest) => {
      try {
        const { id, ...body } = payload;
        return await getEnterpriseSDK().dynamicSecrets.updateDynamicSecretEngine(id, body);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "dynamic-secret-engines"] });
    },
  });
}

export function useDeleteDynamicSecretEngine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await getEnterpriseSDK().dynamicSecrets.deleteDynamicSecretEngine(id);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "dynamic-secret-engines"] });
    },
  });
}

export function useDynamicSecretLeases(engineId?: string) {
  return useQuery({
    queryKey: ["enterprise", "dynamic-secret-leases", engineId],
    queryFn: async () => {
      try {
        return await getEnterpriseSDK().dynamicSecrets.getDynamicSecretLeases(engineId!);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    enabled: isEnterpriseUiEnabled() && Boolean(engineId),
  });
}

export function useCreateDynamicSecretLease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { engineId: string } & CreateDynamicSecretLeaseRequest) => {
      try {
        const { engineId, ...body } = payload;
        return await getEnterpriseSDK().dynamicSecrets.createDynamicSecretLease(engineId, body);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["enterprise", "dynamic-secret-leases", variables.engineId],
      });
    },
  });
}

export function useRevokeDynamicSecretLease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { engineId: string; leaseId: string }) => {
      try {
        return await getEnterpriseSDK().dynamicSecrets.revokeDynamicSecretLease(payload.leaseId);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({
        queryKey: ["enterprise", "dynamic-secret-leases", variables.engineId],
      });
    },
  });
}

export function useLogForwardingConfigs() {
  return useQuery({
    queryKey: ["enterprise", "log-forwarding"],
    queryFn: async () => {
      try {
        return await getEnterpriseSDK().logForwarding.getLogForwardingConfigs();
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    enabled: isEnterpriseUiEnabled(),
  });
}

export function useCreateLogForwardingConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateLogForwardingRequest) => {
      try {
        return await getEnterpriseSDK().logForwarding.createLogForwardingConfig(payload);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "log-forwarding"] });
    },
  });
}

export function useDeleteLogForwardingConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        return await getEnterpriseSDK().logForwarding.deleteLogForwardingConfig(id);
      } catch (error) {
        throw new Error(enterpriseErrorMessage(error));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["enterprise", "log-forwarding"] });
    },
  });
}

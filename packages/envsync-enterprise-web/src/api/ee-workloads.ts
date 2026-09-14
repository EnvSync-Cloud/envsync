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

import { getEnterpriseSDK } from "./client";
import { useEnterpriseMutation, useEnterpriseQuery } from "./query";

const oidcKey = ["enterprise", "oidc-providers"] as const;
const logForwardingKey = ["enterprise", "log-forwarding"] as const;
const dynamicEnginesKey = ["enterprise", "dynamic-secret-engines"] as const;
const rotationKey = (appId?: string) => ["enterprise", "rotation-policies", appId] as const;
const leaseKey = (engineId?: string) => ["enterprise", "dynamic-secret-leases", engineId] as const;

export function useOidcProviders() {
  return useEnterpriseQuery(oidcKey, () => getEnterpriseSDK().oidcProviders.getAllOidcProviders());
}

export function useCreateOidcProvider() {
  return useEnterpriseMutation(
    (payload: CreateOidcProviderRequest) => getEnterpriseSDK().oidcProviders.createOidcProvider(payload),
    oidcKey,
  );
}

export function useUpdateOidcProvider() {
  return useEnterpriseMutation(
    ({ id, ...body }: { id: string } & UpdateOidcProviderRequest) =>
      getEnterpriseSDK().oidcProviders.updateOidcProvider(id, body),
    oidcKey,
  );
}

export function useDeleteOidcProvider() {
  return useEnterpriseMutation(
    (id: string) => getEnterpriseSDK().oidcProviders.deleteOidcProvider(id),
    oidcKey,
  );
}

export function useRotationPolicies(appId?: string) {
  return useEnterpriseQuery(
    rotationKey(appId),
    () => getEnterpriseSDK().rotation.getRotationPolicies(appId),
    Boolean(appId),
  );
}

export function useCreateRotationPolicy() {
  return useEnterpriseMutation(
    (payload: CreateRotationPolicyRequest) => getEnterpriseSDK().rotation.createRotationPolicy(payload),
    (variables) => rotationKey(variables.app_id),
  );
}

export function useUpdateRotationPolicy() {
  return useEnterpriseMutation(
    ({ id, appId: _appId, ...body }: { id: string; appId: string } & UpdateRotationPolicyRequest) =>
      getEnterpriseSDK().rotation.updateRotationPolicy(id, body),
    (variables) => rotationKey(variables.appId),
  );
}

export function useDeleteRotationPolicy() {
  return useEnterpriseMutation(
    (payload: { id: string; appId: string }) => getEnterpriseSDK().rotation.deleteRotationPolicy(payload.id),
    (variables) => rotationKey(variables.appId),
  );
}

export function useTriggerRotation() {
  return useEnterpriseMutation(
    (payload: { id: string; appId: string }) => getEnterpriseSDK().rotation.triggerRotation(payload.id),
    (variables) => rotationKey(variables.appId),
  );
}

export function useDynamicSecretEngines() {
  return useEnterpriseQuery(dynamicEnginesKey, () =>
    getEnterpriseSDK().dynamicSecrets.getAllDynamicSecretEngines(),
  );
}

export function useCreateDynamicSecretEngine() {
  return useEnterpriseMutation(
    (payload: CreateDynamicSecretEngineRequest) =>
      getEnterpriseSDK().dynamicSecrets.createDynamicSecretEngine(payload),
    dynamicEnginesKey,
  );
}

export function useUpdateDynamicSecretEngine() {
  return useEnterpriseMutation(
    ({ id, ...body }: { id: string } & UpdateDynamicSecretEngineRequest) =>
      getEnterpriseSDK().dynamicSecrets.updateDynamicSecretEngine(id, body),
    dynamicEnginesKey,
  );
}

export function useDeleteDynamicSecretEngine() {
  return useEnterpriseMutation(
    (id: string) => getEnterpriseSDK().dynamicSecrets.deleteDynamicSecretEngine(id),
    dynamicEnginesKey,
  );
}

export function useDynamicSecretLeases(engineId?: string) {
  return useEnterpriseQuery(
    leaseKey(engineId),
    () => getEnterpriseSDK().dynamicSecrets.getDynamicSecretLeases(engineId!),
    Boolean(engineId),
  );
}

export function useCreateDynamicSecretLease() {
  return useEnterpriseMutation(
    ({ engineId, ...body }: { engineId: string } & CreateDynamicSecretLeaseRequest) =>
      getEnterpriseSDK().dynamicSecrets.createDynamicSecretLease(engineId, body),
    (variables) => leaseKey(variables.engineId),
  );
}

export function useRevokeDynamicSecretLease() {
  return useEnterpriseMutation(
    (payload: { engineId: string; leaseId: string }) =>
      getEnterpriseSDK().dynamicSecrets.revokeDynamicSecretLease(payload.leaseId),
    (variables) => leaseKey(variables.engineId),
  );
}

export function useLogForwardingConfigs() {
  return useEnterpriseQuery(logForwardingKey, () =>
    getEnterpriseSDK().logForwarding.getLogForwardingConfigs(),
  );
}

export function useCreateLogForwardingConfig() {
  return useEnterpriseMutation(
    (payload: CreateLogForwardingRequest) =>
      getEnterpriseSDK().logForwarding.createLogForwardingConfig(payload),
    logForwardingKey,
  );
}

export function useDeleteLogForwardingConfig() {
  return useEnterpriseMutation(
    (id: string) => getEnterpriseSDK().logForwarding.deleteLogForwardingConfig(id),
    logForwardingKey,
  );
}

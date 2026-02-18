import { useMutation, useQuery } from "@tanstack/react-query";
import { MutationOptions, sdk } from "./base";
import { API_KEYS } from "../constants";
import { useInvalidateQueries } from "@/hooks/useApi";
import type {
  GpgKeyResponse,
  GpgKeyDetailResponse,
  GpgKeysResponse,
  GenerateGpgKeyRequest,
  ImportGpgKeyRequest,
  SignDataRequest,
  VerifySignatureRequest,
  SignatureResponse,
  VerifyResponse,
  ExportKeyResponse,
} from "@envsync-cloud/envsync-ts-sdk";

// ─── Re-export SDK types for backward compatibility ──────────────────
export type {
  GpgKeyResponse,
  GpgKeyDetailResponse,
  GpgKeysResponse,
  GenerateGpgKeyRequest,
  ImportGpgKeyRequest,
  SignDataRequest,
  VerifySignatureRequest,
  SignatureResponse,
  VerifyResponse,
  ExportKeyResponse,
};

/** @deprecated Use GpgKeyResponse instead */
export type GpgKey = GpgKeyResponse;

// ─── Hooks ──────────────────────────────────────────────────────────

const useGpgKeys = () => {
  return useQuery({
    queryKey: [API_KEYS.ALL_GPG_KEYS],
    queryFn: () => sdk.gpgKeys.listGpgKeys(),
    refetchInterval: 5 * 60 * 1000,
    retry: 3,
  });
};

const useGpgKey = (id: string) => {
  return useQuery({
    queryKey: [API_KEYS.ALL_GPG_KEYS, id],
    queryFn: () => sdk.gpgKeys.getGpgKey(id),
    enabled: !!id,
  });
};

const useGenerateGpgKey = ({
  onSuccess,
  onError,
}: MutationOptions<GpgKeyResponse, GenerateGpgKeyRequest> = {}) => {
  const { invalidateGpgKeys } = useInvalidateQueries();

  return useMutation({
    mutationFn: (data: GenerateGpgKeyRequest) =>
      sdk.gpgKeys.generateGpgKey(data),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateGpgKeys();
    },
    onError: (error, variables) => {
      console.error("Failed to generate GPG key:", error);
      onError?.({ error, variables });
    },
  });
};

const useImportGpgKey = ({
  onSuccess,
  onError,
}: MutationOptions<GpgKeyResponse, ImportGpgKeyRequest> = {}) => {
  const { invalidateGpgKeys } = useInvalidateQueries();

  return useMutation({
    mutationFn: (data: ImportGpgKeyRequest) =>
      sdk.gpgKeys.importGpgKey(data),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateGpgKeys();
    },
    onError: (error, variables) => {
      console.error("Failed to import GPG key:", error);
      onError?.({ error, variables });
    },
  });
};

const useDeleteGpgKey = ({
  onSuccess,
  onError,
}: MutationOptions<unknown, string> = {}) => {
  const { invalidateGpgKeys } = useInvalidateQueries();

  return useMutation({
    mutationFn: (id: string) => sdk.gpgKeys.deleteGpgKey(id),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateGpgKeys();
    },
    onError: (error, variables) => {
      console.error("Failed to delete GPG key:", error);
      onError?.({ error, variables });
    },
  });
};

const useRevokeGpgKey = ({
  onSuccess,
  onError,
}: MutationOptions<GpgKeyDetailResponse, { id: string; reason?: string }> = {}) => {
  const { invalidateGpgKeys } = useInvalidateQueries();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      sdk.gpgKeys.revokeGpgKey(id, { reason }),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateGpgKeys();
    },
    onError: (error, variables) => {
      console.error("Failed to revoke GPG key:", error);
      onError?.({ error, variables });
    },
  });
};

const useExportGpgKey = (id: string) => {
  return useQuery({
    queryKey: [API_KEYS.ALL_GPG_KEYS, id, "export"],
    queryFn: () => sdk.gpgKeys.exportGpgPublicKey(id),
    enabled: false, // Manual fetch
  });
};

const useSignData = ({
  onSuccess,
  onError,
}: MutationOptions<SignatureResponse, SignDataRequest> = {}) => {
  return useMutation({
    mutationFn: (data: SignDataRequest) =>
      sdk.gpgKeys.signDataWithGpgKey(data),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
    },
    onError: (error, variables) => {
      console.error("Failed to sign data:", error);
      onError?.({ error, variables });
    },
  });
};

const useVerifySignature = ({
  onSuccess,
  onError,
}: MutationOptions<VerifyResponse, VerifySignatureRequest> = {}) => {
  return useMutation({
    mutationFn: (data: VerifySignatureRequest) =>
      sdk.gpgKeys.verifyGpgSignature(data),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
    },
    onError: (error, variables) => {
      console.error("Failed to verify signature:", error);
      onError?.({ error, variables });
    },
  });
};

export const gpgKeys = {
  getGpgKeys: useGpgKeys,
  getGpgKey: useGpgKey,
  generateGpgKey: useGenerateGpgKey,
  importGpgKey: useImportGpgKey,
  deleteGpgKey: useDeleteGpgKey,
  revokeGpgKey: useRevokeGpgKey,
  exportGpgKey: useExportGpgKey,
  signData: useSignData,
  verifySignature: useVerifySignature,
};

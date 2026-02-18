import { useMutation, useQuery } from "@tanstack/react-query";
import { MutationOptions, sdk } from "./base";
import { API_KEYS } from "../constants";
import { useInvalidateQueries } from "@/hooks/useApi";
import type {
  CertificateListResponse,
  InitOrgCARequest,
  IssueMemberCertRequest,
  RevokeCertRequest,
  MemberCertResponse,
  OrgCAResponse,
  CRLResponse,
  OCSPResponse,
  RootCAResponse,
  RevokeCertResponse,
} from "@envsync-cloud/envsync-ts-sdk";

// ─── Re-export SDK types for backward compatibility ──────────────────
export type {
  CertificateListResponse,
  InitOrgCARequest,
  IssueMemberCertRequest,
  RevokeCertRequest,
  MemberCertResponse,
  OrgCAResponse,
  CRLResponse,
  OCSPResponse,
  RootCAResponse,
  RevokeCertResponse,
};

/** @deprecated Use CertificateListResponse[number] instead */
export type OrgCertificate = CertificateListResponse[number];

// ─── Hooks ──────────────────────────────────────────────────────────

const useCertificates = () => {
  return useQuery({
    queryKey: [API_KEYS.ALL_CERTIFICATES],
    queryFn: () => sdk.certificates.listCertificates(),
    refetchInterval: 5 * 60 * 1000,
    retry: 3,
  });
};

const useOrgCA = () => {
  return useQuery({
    queryKey: [API_KEYS.ALL_CERTIFICATES, "ca"],
    queryFn: () => sdk.certificates.getOrgCa(),
    retry: false,
  });
};

const useRootCA = () => {
  return useQuery({
    queryKey: [API_KEYS.ALL_CERTIFICATES, "root-ca"],
    queryFn: () => sdk.certificates.getRootCa(),
  });
};

const useInitOrgCA = ({
  onSuccess,
  onError,
}: MutationOptions<OrgCAResponse, InitOrgCARequest> = {}) => {
  const { invalidateCertificates } = useInvalidateQueries();

  return useMutation({
    mutationFn: (data: InitOrgCARequest) =>
      sdk.certificates.initOrgCa(data),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateCertificates();
    },
    onError: (error, variables) => {
      console.error("Failed to initialize org CA:", error);
      onError?.({ error, variables });
    },
  });
};

const useIssueMemberCert = ({
  onSuccess,
  onError,
}: MutationOptions<MemberCertResponse, IssueMemberCertRequest> = {}) => {
  const { invalidateCertificates } = useInvalidateQueries();

  return useMutation({
    mutationFn: (data: IssueMemberCertRequest) =>
      sdk.certificates.issueMemberCert(data),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateCertificates();
    },
    onError: (error, variables) => {
      console.error("Failed to issue member certificate:", error);
      onError?.({ error, variables });
    },
  });
};

const useRevokeCert = ({
  onSuccess,
  onError,
}: MutationOptions<RevokeCertResponse, { serialHex: string; reason: number }> = {}) => {
  const { invalidateCertificates } = useInvalidateQueries();

  return useMutation({
    mutationFn: ({ serialHex, reason }: { serialHex: string; reason: number }) =>
      sdk.certificates.revokeCert(serialHex, { reason }),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateCertificates();
    },
    onError: (error, variables) => {
      console.error("Failed to revoke certificate:", error);
      onError?.({ error, variables });
    },
  });
};

const useCRL = () => {
  return useQuery({
    queryKey: [API_KEYS.ALL_CERTIFICATES, "crl"],
    queryFn: () => sdk.certificates.getCrl(),
    enabled: false,
  });
};

const useCheckOCSP = (serialHex: string) => {
  return useQuery({
    queryKey: [API_KEYS.ALL_CERTIFICATES, "ocsp", serialHex],
    queryFn: () => sdk.certificates.checkOcsp(serialHex),
    enabled: false,
  });
};

export const certificates = {
  getCertificates: useCertificates,
  getOrgCA: useOrgCA,
  getRootCA: useRootCA,
  initOrgCA: useInitOrgCA,
  issueMemberCert: useIssueMemberCert,
  revokeCert: useRevokeCert,
  getCRL: useCRL,
  checkOCSP: useCheckOCSP,
};

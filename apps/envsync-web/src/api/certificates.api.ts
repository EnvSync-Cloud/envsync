import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, MutationOptions, sdk } from "./base";
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

export interface MyCertificateBundleResponse {
  root_ca_pem: string;
  member_certificate: OrgCertificate & {
    cert_pem?: string | null;
    key_pem: string;
    is_system_generated: boolean;
    metadata?: Record<string, string> | null;
  };
}

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

const useMyCertificateBundle = () => {
  return useQuery({
    queryKey: [API_KEYS.ALL_CERTIFICATES, "me"],
    queryFn: () => apiRequest<MyCertificateBundleResponse>("/api/certificate/me"),
    retry: false,
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

export type IssueLeafCertRequest = {
  app_id: string;
  env_type_id?: string;
  common_name: string;
  sans?: string[];
  ttl_days?: number;
  key_algorithm?: "ECDSA_P256" | "RSA_2048";
  description?: string;
};

export type SignCsrRequest = {
  app_id?: string;
  csr_pem: string;
  ttl_days?: number;
  description?: string;
};

const useIssueLeafCert = ({
  onSuccess,
  onError,
}: MutationOptions<MemberCertResponse, IssueLeafCertRequest> = {}) => {
  const { invalidateCertificates } = useInvalidateQueries();
  return useMutation({
    mutationFn: (data: IssueLeafCertRequest) =>
      apiRequest<MemberCertResponse>("/api/certificate/issue-leaf", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateCertificates();
    },
    onError: (error, variables) => {
      onError?.({ error: error as Error, variables });
    },
  });
};

const useSignCsr = ({
  onSuccess,
  onError,
}: MutationOptions<OrgCAResponse, SignCsrRequest> = {}) => {
  const { invalidateCertificates } = useInvalidateQueries();
  return useMutation({
    mutationFn: (data: SignCsrRequest) =>
      apiRequest<OrgCAResponse>("/api/certificate/sign-csr", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateCertificates();
    },
    onError: (error, variables) => {
      onError?.({ error: error as Error, variables });
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

const useRenewCert = ({
  onSuccess,
  onError,
}: MutationOptions<MemberCertResponse, { id: string; description?: string; revoke_previous?: boolean }> = {}) => {
  const { invalidateCertificates } = useInvalidateQueries();

  return useMutation({
    mutationFn: ({ id, description, revoke_previous = true }: { id: string; description?: string; revoke_previous?: boolean }) =>
      apiRequest<MemberCertResponse>(`/api/certificate/${id}/renew`, {
        method: "POST",
        body: JSON.stringify({ description, revoke_previous }),
      }),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateCertificates();
    },
    onError: (error, variables) => {
      console.error("Failed to renew certificate:", error);
      onError?.({ error: error as Error, variables });
    },
  });
};

const useRotateCert = ({
  onSuccess,
  onError,
}: MutationOptions<MemberCertResponse, { id: string; description?: string; revoke_previous?: boolean; reason?: number }> = {}) => {
  const { invalidateCertificates } = useInvalidateQueries();

  return useMutation({
    mutationFn: ({ id, description, revoke_previous = true, reason = 0 }: { id: string; description?: string; revoke_previous?: boolean; reason?: number }) =>
      apiRequest<MemberCertResponse>(`/api/certificate/${id}/rotate`, {
        method: "POST",
        body: JSON.stringify({ description, revoke_previous, reason }),
      }),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateCertificates();
    },
    onError: (error, variables) => {
      console.error("Failed to rotate certificate:", error);
      onError?.({ error: error as Error, variables });
    },
  });
};

const useSetAutoRenew = ({
  onSuccess,
  onError,
}: MutationOptions<OrgCAResponse, { id: string; auto_renew: boolean; renew_days_before?: number; env_type_id?: string | null }> = {}) => {
  const { invalidateCertificates } = useInvalidateQueries();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; auto_renew: boolean; renew_days_before?: number; env_type_id?: string | null }) =>
      apiRequest<OrgCAResponse>(`/api/certificate/${id}/auto-renew`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (data, variables) => {
      onSuccess?.({ data, variables });
      invalidateCertificates();
    },
    onError: (error, variables) => {
      onError?.({ error: error as Error, variables });
    },
  });
};

export const certificates = {
  getCertificates: useCertificates,
  getOrgCA: useOrgCA,
  getRootCA: useRootCA,
  getMyCertificateBundle: useMyCertificateBundle,
  initOrgCA: useInitOrgCA,
  issueMemberCert: useIssueMemberCert,
  issueLeafCert: useIssueLeafCert,
  signCsr: useSignCsr,
  revokeCert: useRevokeCert,
  getCRL: useCRL,
  checkOCSP: useCheckOCSP,
  renewCert: useRenewCert,
  rotateCert: useRotateCert,
  setAutoRenew: useSetAutoRenew,
};

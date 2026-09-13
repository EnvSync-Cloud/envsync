import type { OrgKmsConfigResponse, OrgKmsJobResponse } from "@envsync-cloud/envsync-ts-sdk";

export const CLOUD_KMS_SOURCES = ["aws-kms", "gcp-kms", "azure-kv"] as const;

export type KmsSource = OrgKmsConfigResponse.source | "managed" | "aws-kms" | "gcp-kms" | "azure-kv";

export const KMS_SOURCE_OPTIONS: Array<{ value: KmsSource; label: string }> = [
  { value: "managed", label: "Managed by EnvSync (miniKMS)" },
  { value: "aws-kms", label: "AWS KMS" },
  { value: "gcp-kms", label: "GCP Cloud KMS" },
  { value: "azure-kv", label: "Azure Key Vault" },
];

const SAFE_JOB_PROGRESS_KEYS = new Set([
  "target",
  "previous_status",
  "allow_root_unwrap",
  "allow_warmup",
  "already_managed",
  "code",
  "completed",
  "total",
  "percent",
]);

const MATERIALISH_KEY = /kek|dek|pem|secret|plaintext|ciphertext|private|material|wrapped/i;

export function isCloudKmsSource(source: string | null | undefined): boolean {
  return (CLOUD_KMS_SOURCES as readonly string[]).includes(source ?? "");
}

/**
 * Cloud attach is Hosted-only. Fail closed: hide cloud controls unless mode
 * is explicitly hosted. Missing/unknown mode stays managed-only.
 */
export function isHostedCmkUi(input: {
  deploymentMode?: string | null;
  runtimeDeploymentMode?: string | null;
}): boolean {
  const mode = input.deploymentMode || input.runtimeDeploymentMode;
  return mode === "hosted";
}

export type KmsFormState = {
  source: KmsSource;
  keyRef: string;
  region: string;
  credentialId: string;
};

export function kmsFormFromConfig(config: {
  source: KmsSource | string;
  key_ref: string | null;
  region: string | null;
  credential_secret_id: string | null;
}): KmsFormState {
  return {
    source: config.source as KmsSource,
    keyRef: config.key_ref ?? "",
    region: config.region ?? "",
    credentialId: config.credential_secret_id ?? "",
  };
}

/**
 * Seed the form from config only on org change. Later refetches (credential
 * create) must not wipe a locally selected credential_secret_id.
 */
export function applyKmsConfigToForm(
  form: KmsFormState,
  config: {
    org_id: string;
    source: KmsSource | string;
    key_ref: string | null;
    region: string | null;
    credential_secret_id: string | null;
  },
  syncedOrgId: string | null,
): { form: KmsFormState; syncedOrgId: string } {
  if (syncedOrgId === config.org_id) {
    return { form, syncedOrgId };
  }
  return { form: kmsFormFromConfig(config), syncedOrgId: config.org_id };
}

export function cloudConfigReady(input: {
  source: string;
  keyRef: string;
  credentialId: string;
}): boolean {
  return isCloudKmsSource(input.source) && Boolean(input.keyRef.trim()) && Boolean(input.credentialId);
}

export function canShowDetach(status: string | null | undefined): boolean {
  return status === "active" || status === "unavailable" || status === "disabled";
}

export function canAttachFromConfig(config: {
  source: string;
  status: string;
  key_ref: string | null;
  credential_secret_id: string | null;
  last_verified_at: string | null;
}): boolean {
  return (
    isCloudKmsSource(config.source)
    && config.status === "pending"
    && Boolean(config.key_ref)
    && Boolean(config.credential_secret_id)
    && Boolean(config.last_verified_at)
  );
}

export function shouldShowJobCard(input: {
  jobStatus?: string | null;
  configStatus?: string | null;
}): boolean {
  if (input.jobStatus === "pending" || input.jobStatus === "running" || input.jobStatus === "failed") {
    return true;
  }
  return input.configStatus === "rotating" && input.jobStatus !== "succeeded";
}

const JOB_STORAGE_PREFIX = "envsync:kms-job:";
const memoryJobStore = new Map<string, string>();

export function kmsJobStorageKey(orgId: string): string {
  return `${JOB_STORAGE_PREFIX}${orgId}`;
}

export function readStoredKmsJobId(orgId: string | null | undefined): string | null {
  if (!orgId) return null;
  const key = kmsJobStorageKey(orgId);
  if (typeof sessionStorage !== "undefined") {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return memoryJobStore.get(key) ?? null;
    }
  }
  return memoryJobStore.get(key) ?? null;
}

export function writeStoredKmsJobId(orgId: string | null | undefined, jobId: string | null): void {
  if (!orgId) return;
  const key = kmsJobStorageKey(orgId);
  if (typeof sessionStorage !== "undefined") {
    try {
      if (jobId) sessionStorage.setItem(key, jobId);
      else sessionStorage.removeItem(key);
      return;
    } catch {
      // fall through to memory
    }
  }
  if (jobId) memoryJobStore.set(key, jobId);
  else memoryJobStore.delete(key);
}

export function kmsSourceLabel(source: string | null | undefined): string {
  return KMS_SOURCE_OPTIONS.find(option => option.value === source)?.label
    ?? source
    ?? "managed";
}

export function jobInFlight(job?: Pick<OrgKmsJobResponse, "status"> | null): boolean {
  return job?.status === "pending" || job?.status === "running";
}

export function configBlocksMutations(config?: Pick<OrgKmsConfigResponse, "status"> | null): boolean {
  return config?.status === "rotating";
}

export function jobProgressPercent(job?: Pick<OrgKmsJobResponse, "status" | "progress"> | null): number {
  if (!job) return 0;
  const progress = job.progress ?? {};
  if (typeof progress.percent === "number" && Number.isFinite(progress.percent)) {
    return Math.max(0, Math.min(100, progress.percent));
  }
  if (typeof progress.completed === "number" && typeof progress.total === "number" && progress.total > 0) {
    return Math.max(0, Math.min(100, Math.round((progress.completed / progress.total) * 100)));
  }
  switch (job.status) {
    case "pending":
      return 15;
    case "running":
      return 55;
    case "succeeded":
    case "failed":
      return 100;
    default:
      return 0;
  }
}

/** Only known metadata keys — never surface values that look like key material. */
export function safeJobProgressEntries(progress: Record<string, unknown> | null | undefined): Array<[string, string]> {
  if (!progress) return [];
  return Object.entries(progress)
    .filter(([key, value]) => {
      if (MATERIALISH_KEY.test(key)) return false;
      if (!SAFE_JOB_PROGRESS_KEYS.has(key)) return false;
      return value !== undefined && value !== null && typeof value !== "object";
    })
    .map(([key, value]) => [key, String(value)]);
}

export function keyRefPlaceholder(source: string): string {
  switch (source) {
    case "aws-kms":
      return "arn:aws:kms:us-east-1:123456789012:key/…";
    case "gcp-kms":
      return "projects/…/locations/…/keyRings/…/cryptoKeys/…";
    case "azure-kv":
      return "https://vault-name.vault.azure.net/keys/key-name";
    default:
      return "Cloud key reference";
  }
}

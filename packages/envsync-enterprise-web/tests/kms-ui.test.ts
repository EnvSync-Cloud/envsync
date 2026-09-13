import { describe, expect, test } from "bun:test";

import {
  applyKmsConfigToForm,
  canAttachFromConfig,
  canShowDetach,
  cloudConfigReady,
  configBlocksMutations,
  isCloudKmsSource,
  isHostedCmkUi,
  jobInFlight,
  jobProgressPercent,
  kmsJobStorageKey,
  readStoredKmsJobId,
  safeJobProgressEntries,
  shouldShowJobCard,
  writeStoredKmsJobId,
} from "../src/lib/kms-ui";

describe("kms UI helpers", () => {
  test("cloud controls stay hidden unless mode is explicitly hosted", () => {
    expect(isHostedCmkUi({ deploymentMode: "selfhosted" })).toBe(false);
    expect(isHostedCmkUi({ runtimeDeploymentMode: "selfhosted" })).toBe(false);
    expect(isHostedCmkUi({ deploymentMode: "hosted" })).toBe(true);
    expect(isHostedCmkUi({})).toBe(false);
  });

  test("creating a credential keeps the new id after config refetch", () => {
    const seeded = applyKmsConfigToForm(
      { source: "managed", keyRef: "", region: "", credentialId: "" },
      {
        org_id: "org_1",
        source: "aws-kms",
        key_ref: "arn:aws:kms:us-east-1:1:key/a",
        region: "us-east-1",
        credential_secret_id: null,
      },
      null,
    );
    expect(seeded.form.credentialId).toBe("");

    const afterCreate = applyKmsConfigToForm(
      { ...seeded.form, credentialId: "cred_new" },
      {
        org_id: "org_1",
        source: "aws-kms",
        key_ref: "arn:aws:kms:us-east-1:1:key/a",
        region: "us-east-1",
        credential_secret_id: null,
      },
      seeded.syncedOrgId,
    );
    expect(afterCreate.form.credentialId).toBe("cred_new");
    expect(cloudConfigReady(afterCreate.form)).toBe(true);
  });

  test("detach is hidden on pending; attach needs saved ref, credential, and verify", () => {
    expect(canShowDetach("pending")).toBe(false);
    expect(canShowDetach("active")).toBe(true);
    expect(canShowDetach("unavailable")).toBe(true);
    expect(
      canAttachFromConfig({
        source: "aws-kms",
        status: "pending",
        key_ref: "arn:aws:kms:us-east-1:1:key/a",
        credential_secret_id: "cred_new",
        last_verified_at: null,
      }),
    ).toBe(false);
    expect(
      canAttachFromConfig({
        source: "aws-kms",
        status: "pending",
        key_ref: "arn:aws:kms:us-east-1:1:key/a",
        credential_secret_id: "cred_new",
        last_verified_at: "2026-09-13T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  test("job card hides succeeded and persists the last id", () => {
    expect(shouldShowJobCard({ jobStatus: "succeeded", configStatus: "active" })).toBe(false);
    expect(shouldShowJobCard({ jobStatus: "failed", configStatus: "pending" })).toBe(true);
    expect(shouldShowJobCard({ jobStatus: undefined, configStatus: "rotating" })).toBe(true);
    expect(kmsJobStorageKey("org_1")).toBe("envsync:kms-job:org_1");
    writeStoredKmsJobId("org_1", "job_1");
    expect(readStoredKmsJobId("org_1")).toBe("job_1");
    writeStoredKmsJobId("org_1", null);
    expect(readStoredKmsJobId("org_1")).toBeNull();
  });

  test("cloud sources are the Hosted providers only", () => {
    expect(isCloudKmsSource("managed")).toBe(false);
    expect(isCloudKmsSource("aws-kms")).toBe(true);
    expect(isCloudKmsSource("gcp-kms")).toBe(true);
    expect(isCloudKmsSource("azure-kv")).toBe(true);
  });

  test("job and rotating status lock mutations", () => {
    expect(jobInFlight({ status: "pending" })).toBe(true);
    expect(jobInFlight({ status: "running" })).toBe(true);
    expect(jobInFlight({ status: "succeeded" })).toBe(false);
    expect(configBlocksMutations({ status: "rotating" })).toBe(true);
    expect(configBlocksMutations({ status: "active" })).toBe(false);
  });

  test("progress never echoes key material fields", () => {
    expect(jobProgressPercent({ status: "pending", progress: {} })).toBe(15);
    expect(jobProgressPercent({ status: "running", progress: { percent: 80 } })).toBe(80);
    expect(
      safeJobProgressEntries({
        target: "TENANT_KEK",
        wrapped_kek: "do-not-show",
        plaintext: "nope",
        allow_root_unwrap: true,
        nested: { secret: 1 },
      }),
    ).toEqual([
      ["target", "TENANT_KEK"],
      ["allow_root_unwrap", "true"],
    ]);
  });
});

import { describe, expect, test } from "bun:test";

import {
  configBlocksMutations,
  isCloudKmsSource,
  isHostedCmkUi,
  jobInFlight,
  jobProgressPercent,
  safeJobProgressEntries,
} from "../src/lib/kms-ui";

describe("kms UI helpers", () => {
  test("self-host hides cloud attach controls", () => {
    expect(isHostedCmkUi({ deploymentMode: "selfhosted" })).toBe(false);
    expect(isHostedCmkUi({ runtimeDeploymentMode: "selfhosted" })).toBe(false);
    expect(isHostedCmkUi({ deploymentMode: "hosted" })).toBe(true);
    expect(isHostedCmkUi({})).toBe(true);
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

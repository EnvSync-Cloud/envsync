import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "bun:test";

import { canCreateOrganizationInUi, inferPageApiBaseUrl, type RuntimeConfig } from "./runtime-config";

function config(overrides: Partial<RuntimeConfig>): RuntimeConfig {
  return {
    apiBaseUrl: "https://api.example.com",
    appBaseUrl: "https://app.example.com",
    authBaseUrl: "https://auth.example.com",
    keycloakRealm: "envsync",
    webClientId: "envsync-web",
    apiDocsUrl: "https://api.example.com/docs",
    edition: "enterprise",
    dashboardVariant: "enterprise",
    managementEnabled: true,
    ...overrides,
  };
}

describe("canCreateOrganizationInUi", () => {
  test("honors an explicit flag", () => {
    expect(canCreateOrganizationInUi(config({ canCreateOrganization: true }))).toBe(true);
    expect(canCreateOrganizationInUi(config({ canCreateOrganization: false, deploymentMode: "hosted" }))).toBe(false);
  });

  test("selfhost never creates orgs in the dashboard", () => {
    expect(canCreateOrganizationInUi(config({ deploymentMode: "selfhosted" }))).toBe(false);
  });

  test("hosted may create orgs", () => {
    expect(canCreateOrganizationInUi(config({ deploymentMode: "hosted" }))).toBe(true);
  });

  test("missing deployment mode fails closed", () => {
    expect(canCreateOrganizationInUi(config({ edition: "enterprise" }))).toBe(false);
    expect(canCreateOrganizationInUi(config({ edition: "oss" }))).toBe(false);
  });
});

describe("inferPageApiBaseUrl", () => {
  test("does not reuse the dashboard port on local lvh.me", () => {
    const local = inferPageApiBaseUrl("app.lvh.me");
    expect(local).not.toContain(":8001");
    expect(new URL(local).port).toBe("4000");
    expect(inferPageApiBaseUrl("localhost")).toBe(local);
  });

  test("derives the API host from a hosted app hostname", () => {
    expect(inferPageApiBaseUrl("app.envsync.cloud", "https:")).toBe("https://api.envsync.cloud");
  });
});

describe("checked-in public runtime-config", () => {
  test("does not ship lvh.me or localhost OTLP", () => {
    const publicConfig = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../public/runtime-config.js"),
      "utf8",
    );
    expect(publicConfig).toContain("deploymentMode: \"selfhosted\"");
    expect(publicConfig).toContain("canCreateOrganization: false");
    expect(publicConfig).not.toContain("lvh.me");
    expect(publicConfig).not.toContain("localhost:4318");
  });
});

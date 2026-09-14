import { describe, expect, test } from "bun:test";

import type { EffectivePermissions } from "@/api/permissions.api";

import { buildProjectNavItems, hasRequiredPermission } from "./context-nav";

const viewerPermissions = {
  can_manage_api_keys: false,
} as EffectivePermissions;

const adminPermissions = {
  can_manage_api_keys: true,
} as EffectivePermissions;

describe("buildProjectNavItems", () => {
  test("drops Settings when can_manage_api_keys is missing", () => {
    const items = buildProjectNavItems("app-1", ["applications"], viewerPermissions);
    expect(items.map((item) => item.id)).not.toContain("project-settings");
  });

  test("keeps Settings when can_manage_api_keys is granted", () => {
    const items = buildProjectNavItems("app-1", ["applications"], adminPermissions);
    expect(items.some((item) => item.id === "project-settings")).toBe(true);
    expect(items.find((item) => item.id === "project-settings")?.href).toBe(
      "/projects/app-1/settings",
    );
  });

  test("adds Approvals only when change-requests is in scope", () => {
    const without = buildProjectNavItems("app-1", ["applications"], adminPermissions);
    expect(without.map((item) => item.id)).not.toContain("project-approvals");

    const withApprovals = buildProjectNavItems(
      "app-1",
      ["applications", "change-requests"],
      adminPermissions,
    );
    expect(withApprovals.map((item) => item.id)).toContain("project-approvals");
    expect(withApprovals.find((item) => item.id === "project-approvals")?.href).toBe(
      "/projects/app-1/approvals",
    );
  });

  test("hasRequiredPermission is true when the flag is unset", () => {
    expect(hasRequiredPermission({ id: "project-variables" } as never)).toBe(true);
    expect(
      hasRequiredPermission(
        { requiredPermission: "can_manage_api_keys" },
        viewerPermissions,
      ),
    ).toBe(false);
  });
});

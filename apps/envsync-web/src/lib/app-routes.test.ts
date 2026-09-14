import { describe, expect, test } from "bun:test";

import {
  LEGACY_REDIRECTS,
  appApprovalsPath,
  appDetailPath,
  appEnvironmentsPath,
  appIntegrationsPath,
  appPointInTimePath,
  applyRouteParams,
  isOrgAccessTab,
  orgAccessPath,
  orgCertificatesPath,
  orgIntegrationsPath,
  orgUsersPath,
} from "./app-routes";

describe("app routes", () => {
  test("canonical project and org paths", () => {
    expect(appDetailPath("app-1")).toBe("/projects/app-1");
    expect(appPointInTimePath("app-1")).toBe("/projects/app-1/pit");
    expect(appApprovalsPath("app-1")).toBe("/projects/app-1/approvals");
    expect(appEnvironmentsPath("app-1")).toBe("/projects/app-1/environments");
    expect(orgUsersPath()).toBe("/org/users");
    expect(orgAccessPath()).toBe("/org/access");
    expect(orgAccessPath("users")).toBe("/org/access/users");
    expect(orgAccessPath("teams")).toBe("/org/access/teams");
    expect(orgAccessPath("roles")).toBe("/org/access/roles");
    expect(isOrgAccessTab("users")).toBe(true);
    expect(isOrgAccessTab("billing")).toBe(false);
    expect(orgCertificatesPath()).toBe("/org/certificates");
  });

  test("covers the required legacy redirects", () => {
    const byPath = Object.fromEntries(LEGACY_REDIRECTS.map((item) => [item.path, item.to]));
    expect(byPath.applications).toBe("/projects");
    expect(byPath["applications/:appId"]).toBe("/projects/:appId");
    expect(byPath["applications/pit/:appId"]).toBe("/projects/:appId/pit");
    expect(byPath.users).toBe("/org/users");
    expect(byPath.teams).toBe("/org/teams");
    expect(byPath.roles).toBe("/org/roles");
    expect(byPath.certificates).toBe("/org/certificates");
    expect(byPath.webhooks).toBe("/org/webhooks");
    expect(byPath["change-requests"]).toBe("/org/change-requests");
  });

  test("does not redirect EE stay-put surfaces", () => {
    expect(LEGACY_REDIRECTS.some((item) => item.path.startsWith("organisation"))).toBe(false);
    expect(
      LEGACY_REDIRECTS.some((item) =>
        item.path === "applications/:appId/integrations"
        || item.path.startsWith("applications/:appId/integrations/"),
      ),
    ).toBe(false);
    expect(appIntegrationsPath("x")).toBe("/applications/x/integrations");
    expect(orgIntegrationsPath()).toBe("/organisation/integrations");
  });

  test("substitutes redirect params", () => {
    expect(applyRouteParams("/projects/:appId/pit", { appId: "app-1" })).toBe("/projects/app-1/pit");
  });
});


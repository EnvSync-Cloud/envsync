import { describe, expect, test } from "bun:test";

import {
  LEGACY_REDIRECTS,
  PALETTE_ORG_LINKS,
  appApprovalsPath,
  appDetailPath,
  appEnvironmentsPath,
  appIntegrationsPath,
  appPointInTimePath,
  appServiceTokensPath,
  appSettingsPath,
  applyRouteParams,
  isOrgAccessTab,
  orgAccessPath,
  orgCertificatesPath,
  orgIntegrationsPath,
  orgRolesPath,
  orgSettingsPath,
  orgTeamsPath,
  orgUsersPath,
} from "./app-routes";

describe("app routes", () => {
  test("canonical project and org paths", () => {
    expect(appDetailPath("app-1")).toBe("/projects/app-1");
    expect(appPointInTimePath("app-1")).toBe("/projects/app-1/pit");
    expect(appApprovalsPath("app-1")).toBe("/projects/app-1/approvals");
    expect(appEnvironmentsPath("app-1")).toBe("/projects/app-1/environments");
    expect(appSettingsPath("app-1")).toBe("/projects/app-1/settings");
    expect(appServiceTokensPath("app-1")).toBe("/projects/app-1/settings/service-tokens");
    expect(orgUsersPath()).toBe("/org/access/users");
    expect(orgAccessPath()).toBe("/org/access");
    expect(orgAccessPath("users")).toBe("/org/access/users");
    expect(orgAccessPath("teams")).toBe("/org/access/teams");
    expect(orgAccessPath("roles")).toBe("/org/access/roles");
    expect(isOrgAccessTab("users")).toBe(true);
    expect(isOrgAccessTab("billing")).toBe(false);
    expect(orgCertificatesPath()).toBe("/org/certificates");
    expect(orgSettingsPath()).toBe("/org");
    expect(Object.fromEntries(PALETTE_ORG_LINKS.map((link) => [link.id, link.href]))).toEqual({
      users: "/org/access/users",
      teams: "/org/access/teams",
      roles: "/org/access/roles",
      apikeys: "/apikeys",
    });
  });

  test("command palette dests use /org/access", () => {
    expect(PALETTE_ORG_LINKS.find((link) => link.id === "users")?.href).toBe("/org/access/users");
    expect(PALETTE_ORG_LINKS.find((link) => link.id === "teams")?.href).toBe("/org/access/teams");
    expect(PALETTE_ORG_LINKS.find((link) => link.id === "roles")?.href).toBe("/org/access/roles");
  });

  test("covers the required legacy redirects", () => {
    const byPath = Object.fromEntries(LEGACY_REDIRECTS.map((item) => [item.path, item.to]));
    expect(byPath.applications).toBe("/projects");
    expect(byPath["applications/:appId"]).toBe("/projects/:appId");
    expect(byPath["applications/pit/:appId"]).toBe("/projects/:appId/pit");
    expect(byPath.users).toBe("/org/access/users");
    expect(byPath.teams).toBe("/org/access/teams");
    expect(byPath.roles).toBe("/org/access/roles");
    expect(byPath["org/users"]).toBe("/org/access/users");
    expect(byPath["applications/:appId/integrations"]).toBe("/projects/:appId/integrations");
    expect(byPath.certificates).toBe("/org/certificates");
    expect(byPath.webhooks).toBe("/org/webhooks");
    expect(byPath["change-requests"]).toBe("/org/change-requests");
    expect(byPath.organisation).toBe("/org");
  });

  test("does not redirect EE stay-put org surfaces", () => {
    expect(LEGACY_REDIRECTS.some((item) => item.path.startsWith("organisation/"))).toBe(false);
    expect(appIntegrationsPath("x")).toBe("/projects/x/integrations");
    expect(orgIntegrationsPath()).toBe("/organisation/integrations");
    expect(orgUsersPath()).toBe(orgAccessPath("users"));
    expect(orgTeamsPath()).toBe(orgAccessPath("teams"));
    expect(orgRolesPath()).toBe(orgAccessPath("roles"));
  });

  test("substitutes redirect params", () => {
    expect(applyRouteParams("/projects/:appId/pit", { appId: "app-1" })).toBe("/projects/app-1/pit");
  });
});


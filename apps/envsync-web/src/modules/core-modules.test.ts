import { describe, expect, test } from "bun:test";

import { getWebNavItems, getWebRoutes } from "./load-modules";
import { coreWebModules } from "./core-modules";

describe("core web routes", () => {
  test("registers canonical project and org routes", () => {
    const routes = getWebRoutes(coreWebModules);
    const paths = routes.map((route) => route.path);

    expect(paths).toContain("projects");
    expect(paths).toContain("projects/:appId");
    expect(paths).toContain("projects/:appId/pit");
    expect(paths).toContain("projects/:appId/approvals");
    expect(paths).toContain("projects/:appId/environments");
    expect(paths).toContain("org/access");
    expect(paths).toContain("org/access/:tab");
    expect(paths).toContain("projects/:appId/settings");
    expect(paths).toContain("projects/:appId/settings/service-tokens");
    expect(paths).toContain("org/certificates");
    expect(paths).toContain("org");
  });

  test("keeps legacy paths as redirects", () => {
    const routes = getWebRoutes(coreWebModules);
    const redirect = (path: string) => routes.find((route) => route.path === path)?.redirectTo;

    expect(redirect("applications")).toBe("/projects");
    expect(redirect("applications/:appId")).toBe("/projects/:appId");
    expect(redirect("users")).toBe("/org/access/users");
    expect(redirect("teams")).toBe("/org/access/teams");
    expect(redirect("roles")).toBe("/org/access/roles");
    expect(redirect("org/users")).toBe("/org/access/users");
    expect(redirect("certificates")).toBe("/org/certificates");
    expect(redirect("webhooks")).toBe("/org/webhooks");
    expect(redirect("change-requests")).toBe("/org/change-requests");
    expect(redirect("projects/:appId/change-requests")).toBe("/projects/:appId/approvals");
    expect(redirect("applications/:appId/integrations")).toBe("/projects/:appId/integrations");
    expect(
      routes
        .filter((route) => route.path?.startsWith("organisation/"))
        .every((route) => !route.redirectTo),
    ).toBe(true);
  });

  test("exposes Users, Teams, and Roles as organization Access items", () => {
    const items = getWebNavItems(coreWebModules);
    expect(items.some((item) => item.id === "users" && item.href === "/org/access/users")).toBe(true);
    expect(items.some((item) => item.id === "teams" && item.href === "/org/access/teams")).toBe(true);
    expect(items.some((item) => item.id === "roles" && item.href === "/org/access/roles")).toBe(true);
    expect(items.some((item) => item.id === "access")).toBe(false);
    expect(items.every((item) => !item.href.startsWith("/applications"))).toBe(true);
    expect(items.every((item) => item.href !== "/org/users" && item.href !== "/users")).toBe(true);
  });

  test("lists GPG Keys with Certificates, not under Organization", () => {
    const groups = coreWebModules.flatMap((module) => module.navGroups);
    const certificateGroup = groups.find((group) => group.label === "Certificates");
    const orgGroup = groups.find((group) => group.label === "Admin");
    const securityGroup = groups.find((group) => group.label === "Security");

    expect(certificateGroup?.items.map((item) => item.id)).toEqual(["certificates", "gpgkeys"]);
    expect(orgGroup?.items.map((item) => item.id)).not.toContain("gpgkeys");
    expect(securityGroup?.items.map((item) => item.id)).toEqual(["apikeys"]);
  });
});


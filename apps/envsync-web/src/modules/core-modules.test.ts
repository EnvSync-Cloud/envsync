import { describe, expect, test } from "bun:test";

import { getWebRoutes } from "./load-modules";
import { coreWebModules } from "./core-modules";

describe("core web routes", () => {
  test("registers canonical project and org routes", () => {
    const routes = getWebRoutes(coreWebModules);
    const paths = routes.map((route) => route.path);

    expect(paths).toContain("projects");
    expect(paths).toContain("projects/:appId");
    expect(paths).toContain("projects/:appId/pit");
    expect(paths).toContain("org/users");
    expect(paths).toContain("org/certificates");
    expect(paths).toContain("org");
  });

  test("keeps legacy paths as redirects", () => {
    const routes = getWebRoutes(coreWebModules);
    const redirect = (path: string) => routes.find((route) => route.path === path)?.redirectTo;

    expect(redirect("applications")).toBe("/projects");
    expect(redirect("applications/:appId")).toBe("/projects/:appId");
    expect(redirect("users")).toBe("/org/users");
    expect(redirect("teams")).toBe("/org/teams");
    expect(redirect("roles")).toBe("/org/roles");
    expect(redirect("certificates")).toBe("/org/certificates");
    expect(redirect("webhooks")).toBe("/org/webhooks");
    expect(redirect("change-requests")).toBe("/org/change-requests");
  });
});

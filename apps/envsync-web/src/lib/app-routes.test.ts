import { describe, expect, test } from "bun:test";

import {
  LEGACY_REDIRECTS,
  appDetailPath,
  appPointInTimePath,
  applyRouteParams,
  orgCertificatesPath,
  orgUsersPath,
} from "./app-routes";

describe("app routes", () => {
  test("canonical project and org paths", () => {
    expect(appDetailPath("app-1")).toBe("/projects/app-1");
    expect(appPointInTimePath("app-1")).toBe("/projects/app-1/pit");
    expect(orgUsersPath()).toBe("/org/users");
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

  test("substitutes redirect params", () => {
    expect(applyRouteParams("/projects/:appId/pit", { appId: "app-1" })).toBe("/projects/app-1/pit");
  });
});

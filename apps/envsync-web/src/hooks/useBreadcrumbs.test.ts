import { describe, expect, test } from "bun:test";

import { buildBreadcrumbs, isProjectIdSegment, labelForSegment } from "../lib/breadcrumbs";

const APP_ID = "11111111-1111-4111-8111-111111111111";
const apps = [{ id: APP_ID, name: "Core Platform" }];

describe("breadcrumb labels", () => {
  test("prefers Organization copy and the new route prefixes", () => {
    expect(labelForSegment("org")).toBe("Organization");
    expect(labelForSegment("organisation")).toBe("Organization");
    expect(labelForSegment("projects")).toBe("Projects");
    expect(labelForSegment("certificates")).toBe("Certificates");
    expect(labelForSegment("pit")).toBe("Recovery");
  });

  test("treats project ids as detail segments", () => {
    expect(isProjectIdSegment(APP_ID)).toBe(true);
    expect(isProjectIdSegment("create")).toBe(false);
  });

  test("adds a Variables crumb on project detail routes", () => {
    expect(buildBreadcrumbs(`/projects/${APP_ID}`, apps).map((crumb) => crumb.label)).toEqual([
      "Projects",
      "Core Platform",
      "Variables",
    ]);
    expect(buildBreadcrumbs(`/projects/${APP_ID}/secrets`, apps).map((crumb) => crumb.label)).toEqual([
      "Projects",
      "Core Platform",
      "Secrets",
    ]);
    expect(buildBreadcrumbs("/org/users").map((crumb) => crumb.label)).toEqual([
      "Organization",
      "Users",
    ]);
  });
});

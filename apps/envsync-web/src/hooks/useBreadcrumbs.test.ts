import { describe, expect, test } from "bun:test";

const ROUTE_LABELS: Record<string, string> = {
  applications: "Projects",
  projects: "Projects",
  org: "Organization",
  organisation: "Organization",
  users: "Users",
  certificates: "Certificates",
  pit: "Recovery",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function labelFor(segment: string) {
  return ROUTE_LABELS[segment] ?? segment;
}

describe("breadcrumb labels", () => {
  test("prefers Organization copy and the new route prefixes", () => {
    expect(labelFor("org")).toBe("Organization");
    expect(labelFor("organisation")).toBe("Organization");
    expect(labelFor("projects")).toBe("Projects");
    expect(labelFor("certificates")).toBe("Certificates");
    expect(labelFor("pit")).toBe("Recovery");
  });

  test("treats project ids as detail segments", () => {
    expect(UUID_REGEX.test("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(UUID_REGEX.test("create")).toBe(false);
  });
});

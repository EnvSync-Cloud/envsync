import { describe, expect, test } from "bun:test";

import { hasEntitledFeature } from "./entitlements";

describe("hasEntitledFeature", () => {
  test("allows routes with no required feature", () => {
    expect(hasEntitledFeature({ features: [] }, undefined)).toBe(true);
    expect(hasEntitledFeature(null, undefined)).toBe(true);
  });

  test("requires the catalog key on the session", () => {
    expect(hasEntitledFeature({ features: ["saml"] }, "integrations")).toBe(false);
    expect(hasEntitledFeature({ features: ["integrations"] }, "integrations")).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";

import { isPlanFeatureRequired, planFlagEnabled } from "./plan";

describe("plan flags", () => {
  test("hides a feature only when the plan limit is false", () => {
    expect(planFlagEnabled({ plan_limits: { point_in_time: false } }, "point_in_time")).toBe(false);
    expect(planFlagEnabled({ plan_limits: { point_in_time: true } }, "point_in_time")).toBe(true);
    expect(planFlagEnabled({}, "point_in_time")).toBe(true);
    expect(planFlagEnabled(null, "point_in_time")).toBe(true);
  });

  test("recognizes a plan feature response from the API body", () => {
    expect(isPlanFeatureRequired({ body: { code: "PLAN_FEATURE_REQUIRED" } })).toBe(true);
    expect(isPlanFeatureRequired({ code: "PLAN_FEATURE_REQUIRED" })).toBe(true);
    expect(isPlanFeatureRequired(new Error("Forbidden"))).toBe(false);
  });
});

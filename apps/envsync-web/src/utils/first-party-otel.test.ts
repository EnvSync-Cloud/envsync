import { describe, expect, test } from "bun:test";

import { firstPartyOtelUrl } from "./first-party-otel";

describe("firstPartyOtelUrl", () => {
  test("rewrites obs.<root> ingest to t.<root>/obs", () => {
    expect(firstPartyOtelUrl("https://obs.envsync.cloud")).toBe("https://t.envsync.cloud/obs");
    expect(firstPartyOtelUrl("https://obs.envsync.cloud/v1/traces")).toBe("https://t.envsync.cloud/obs");
  });

  test("leaves first-party and local endpoints alone", () => {
    expect(firstPartyOtelUrl("https://t.envsync.cloud/obs")).toBe("https://t.envsync.cloud/obs");
    expect(firstPartyOtelUrl("http://localhost:4318")).toBe("http://localhost:4318");
  });
});

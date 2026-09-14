import { describe, expect, test } from "bun:test";

import {
  getAppIdFromPath,
  getShellContext,
  isProjectPitPath,
  productHomeHref,
} from "./shell-context";

describe("shell context", () => {
  test("reads project ids from canonical and legacy paths", () => {
    expect(getAppIdFromPath("/projects/app-1/secrets")).toBe("app-1");
    expect(getAppIdFromPath("/projects/create")).toBeNull();
    expect(getAppIdFromPath("/applications/app-2/access")).toBe("app-2");
    expect(getAppIdFromPath("/applications/pit/app-3")).toBe("app-3");
    expect(getAppIdFromPath("/applications/create")).toBeNull();
  });

  test("maps routes onto products", () => {
    expect(getShellContext("/projects/app-1").product).toBe("secrets");
    expect(getShellContext("/dashboard").product).toBe("secrets");
    expect(getShellContext("/org/certificates").product).toBe("certificates");
    expect(getShellContext("/org/users").product).toBe("organization");
    expect(getShellContext("/organisation/license").product).toBe("organization");
    expect(getShellContext("/organisation").product).toBe("organization");
  });

  test("does not treat /organisation as /org prefix bleed", () => {
    expect(getShellContext("/organisation").product).toBe("organization");
    expect(getAppIdFromPath("/organisation")).toBeNull();
  });

  test("detects project recovery paths", () => {
    expect(isProjectPitPath("/projects/app-1/pit")).toBe(true);
    expect(isProjectPitPath("/projects/app-1/pit/secrets")).toBe(true);
    expect(isProjectPitPath("/applications/pit/app-1")).toBe(true);
    expect(isProjectPitPath("/projects/app-1/secrets")).toBe(false);
  });

  test("keeps organization and certificate product homes stable", () => {
    expect(productHomeHref("organization")).toBe("/org/users");
    expect(productHomeHref("certificates")).toBe("/org/certificates");
  });
});

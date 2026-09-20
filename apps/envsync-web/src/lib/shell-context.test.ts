import { beforeEach, describe, expect, test } from "bun:test";

import {
  clearLastProjectId,
  getAppIdFromPath,
  getShellContext,
  isProjectPitPath,
  lastProjectStorageKey,
  productHomeHref,
  secretsHomeHref,
  writeLastProjectId,
} from "./shell-context";

const memory = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => {
    memory.clear();
  },
  key: (index: number) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size;
  },
};

Object.defineProperty(globalThis, "localStorage", {
  value: memoryStorage,
  configurable: true,
});

beforeEach(() => {
  memory.clear();
});

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
    expect(getShellContext("/org/certificates").product).toBe("organization");
    expect(getShellContext("/gpgkeys").product).toBe("organization");
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
    expect(productHomeHref("organization")).toBe("/org/access");
  });

  test("only reuses a last project when it belongs to the current org allowlist", () => {
    writeLastProjectId("org-a", "app-a");
    writeLastProjectId("org-b", "app-b");

    expect(secretsHomeHref([], "org-a")).toBe("/projects");
    expect(secretsHomeHref(["app-a"], "org-a")).toBe("/projects/app-a");
    expect(secretsHomeHref(["app-other"], "org-a")).toBe("/projects");
    expect(secretsHomeHref(["app-b"], "org-b")).toBe("/projects/app-b");
    expect(productHomeHref("secrets", ["app-a"], "org-b")).toBe("/projects");
    expect(lastProjectStorageKey("org-a")).toBe("envsync-last-project-id:org-a");

    clearLastProjectId("org-a");
    expect(secretsHomeHref(["app-a"], "org-a")).toBe("/projects");
    expect(secretsHomeHref(["app-b"], "org-b")).toBe("/projects/app-b");
  });
});


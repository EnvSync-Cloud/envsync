import { describe, expect, test } from "bun:test";

import { assertDeployReleaseVersion } from "./release-version.ts";

describe("deploy release versions", () => {
	test("accepts a stable version and an rc", () => {
		expect(() => assertDeployReleaseVersion("0.26.0")).not.toThrow();
		expect(() => assertDeployReleaseVersion("0.27.0-rc.1")).not.toThrow();
		expect(() => assertDeployReleaseVersion("0.27.0-rc.10", "target release version")).not.toThrow();
	});

	test("rejects channels, tags, and malformed rcs", () => {
		for (const version of ["0.27", "v0.27.0-rc.1", "0.27.0-rc.0", "0.27.0-rc.01", "0.27.0-beta.1", "stable"]) {
			expect(() => assertDeployReleaseVersion(version)).toThrow(/Expected x\.y\.z or x\.y\.z-rc\.N/);
		}
	});
});

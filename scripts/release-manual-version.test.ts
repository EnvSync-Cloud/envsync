import { expect, test } from "bun:test";

import { resolveManualReleaseVersion } from "./release-manual-version.ts";

test("empty inputs mean the caller cuts the next rc", () => {
	expect(resolveManualReleaseVersion({ current: "0.26.1-rc.2", version: "", rc: "  " })).toBeNull();
});

test("a core version without an rc is stable", () => {
	expect(resolveManualReleaseVersion({ current: "0.26.1-rc.2", version: "v0.27.0", rc: "" })).toBe("0.27.0");
});

test("a core version plus an rc number builds the prerelease", () => {
	expect(resolveManualReleaseVersion({ current: "0.26.1-rc.2", version: "0.27.0", rc: "2" })).toBe("0.27.0-rc.2");
});

test("an rc number alone uses the current core", () => {
	expect(resolveManualReleaseVersion({ current: "v0.26.1-rc.2", version: "", rc: "4" })).toBe("0.26.1-rc.4");
});

test("a full prerelease is accepted when rc is empty", () => {
	expect(resolveManualReleaseVersion({ current: "0.26.1", version: "0.27.0-rc.3", rc: "" })).toBe("0.27.0-rc.3");
});

test("an rc on both inputs is rejected", () => {
	expect(() => resolveManualReleaseVersion({ current: "0.26.1", version: "0.27.0-rc.1", rc: "2" })).toThrow(
		/already includes an rc/,
	);
});

test("leading zeros and rc 0 are rejected", () => {
	expect(() => resolveManualReleaseVersion({ current: "0.26.1", version: "", rc: "0" })).toThrow(/Invalid rc/);
	expect(() => resolveManualReleaseVersion({ current: "0.26.1", version: "", rc: "01" })).toThrow(/Invalid rc/);
	expect(() => resolveManualReleaseVersion({ current: "0.26.1", version: "0.27", rc: "" })).toThrow(/Invalid version/);
});

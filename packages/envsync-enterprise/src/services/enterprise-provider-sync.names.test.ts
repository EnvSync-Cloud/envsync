import { describe, expect, test } from "bun:test";

import {
	collapseSlashes,
	sanitizeGoogleSecretId,
	sanitizeSecretKey,
	trimSlashes,
} from "./provider-sync-names";

describe("provider sync names", () => {
	test("collapses underscores without a quantified regular expression", () => {
		expect(sanitizeSecretKey(`foo${"_".repeat(200)}bar.baz`)).toBe("FOO_BAR_BAZ");
		expect(sanitizeSecretKey("___already___")).toBe("ALREADY");
	});

	test("collapses hyphens in a Google secret id", () => {
		expect(sanitizeGoogleSecretId(`////${"-".repeat(200)}name`)).toBe("name");
		expect(sanitizeGoogleSecretId("---")).toBe("ENVSYNC_SECRET");
	});

	test("collapses and trims slashes in one pass", () => {
		expect(collapseSlashes(`/${"/".repeat(200)}a//b`)).toBe("/a/b");
		expect(trimSlashes(`/${"/".repeat(200)}projects/demo/`)).toBe("projects/demo");
	});
});

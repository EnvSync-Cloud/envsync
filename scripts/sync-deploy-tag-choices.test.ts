import { expect, test } from "bun:test";

import { replaceDeployTagOptions, selectDeployTags } from "./sync-deploy-tag-choices.ts";

const yaml = [
	"        options:",
	"          # BEGIN deploy-tag-options",
	"          - v0.1.0",
	"          # END deploy-tag-options",
	"        required: true",
	"",
].join("\n");

test("selects the newest stable tags and drops prereleases", () => {
	expect(selectDeployTags(["v0.2.0", "v0.10.0", "v0.2.0-rc.1", "v0.9.0", "v0.10.0"], 2)).toEqual([
		"v0.10.0",
		"v0.9.0",
	]);
});

test("replaces only the marked dropdown options", () => {
	const next = replaceDeployTagOptions(yaml, ["v0.26.0", "v0.25.3", "v0.26.1-rc.2"]);
	expect(next).toContain("          # BEGIN deploy-tag-options\n          - v0.26.0\n          - v0.25.3\n          # END deploy-tag-options");
	expect(next).toContain("required: true");
	expect(next).not.toContain("v0.1.0");
	expect(next).not.toContain("rc");
});

test("rejects a workflow file without the markers", () => {
	expect(() => replaceDeployTagOptions("options:\n  - v0.1.0\n", ["v0.2.0"])).toThrow(/markers/);
});

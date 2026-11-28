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

test("selects newest stable and rc tags, with a stable tag ahead of its own rcs", () => {
	expect(
		selectDeployTags(
			["v0.26.0", "v0.26.0-rc.2", "v0.26.0-rc.10", "v0.26.1-rc.1", "v0.25.3", "not-a-tag", "v0.26.0"],
			5,
		),
	).toEqual(["v0.26.1-rc.1", "v0.26.0", "v0.26.0-rc.10", "v0.26.0-rc.2", "v0.25.3"]);
});

test("replaces only the marked dropdown options", () => {
	const next = replaceDeployTagOptions(yaml, ["v0.26.0", "v0.25.3", "v0.26.1-rc.2"]);
	expect(next).toContain(
		"          # BEGIN deploy-tag-options\n          - v0.26.1-rc.2\n          - v0.26.0\n          - v0.25.3\n          # END deploy-tag-options",
	);
	expect(next).toContain("required: true");
	expect(next).not.toContain("v0.1.0");
});

test("rejects a workflow file without the markers", () => {
	expect(() => replaceDeployTagOptions("options:\n  - v0.1.0\n", ["v0.2.0"])).toThrow(/markers/);
});

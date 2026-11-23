import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";

function blockAfter(source: string, marker: string): string {
	const at = source.indexOf(marker);
	if (at < 0) throw new Error(`missing marker: ${marker}`);
	const open = source.indexOf("{", at);
	let depth = 0;
	for (let i = open; i < source.length; i += 1) {
		const char = source[i];
		if (char === "{") depth += 1;
		else if (char === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(open + 1, i);
		}
	}
	throw new Error(`unclosed block after ${marker}`);
}

describe("cmdDeploy rolling convergence placement", () => {
	const source = readFileSync(path.join(import.meta.dir, "cli.ts"), "utf8");
	const deploy = blockAfter(source, "async function cmdDeploy(");

	test("an API upgrade waits inside the candidate try before promotion and snapshot removal", () => {
		const candidate = blockAfter(deploy, "try {");
		const migrate = candidate.indexOf("runMiniKmsMigrate(config, renderHelpers.buildRuntimeEnv(config, candidateState))");
		const wait = candidate.indexOf("waitForRequestedRollingServices(config)");
		const promoted = candidate.indexOf("promoted = true");
		const snapshot = candidate.lastIndexOf("removeSealedSnapshot(snapshotPath)");
		expect(migrate).toBeGreaterThan(-1);
		expect(wait).toBeGreaterThan(migrate);
		expect(promoted).toBeGreaterThan(wait);
		expect(snapshot).toBeGreaterThan(promoted);
	});

	test("the steady path waits only when the candidate release was not promoted", () => {
		const steady = blockAfter(deploy, "if (!promoted) {");
		expect(steady).toContain("deployRenderedStack(config, \"steady\")");
		expect(steady).toContain("runMiniKmsMigrate(config, renderHelpers.buildRuntimeEnv(config, currentState))");
		expect(steady).toContain("waitForRequestedRollingServices(config)");
		const steadyEnd = deploy.indexOf(steady) + steady.length;
		const beforeReplicaWait = deploy.slice(steadyEnd, deploy.indexOf("waitForHealthyServices(config, ["));
		expect(beforeReplicaWait).not.toContain("waitForRequestedRollingServices");
		expect(beforeReplicaWait).not.toContain("runMiniKmsMigrate");
	});
});

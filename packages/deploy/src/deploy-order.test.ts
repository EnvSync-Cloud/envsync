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
		const promote = candidate.indexOf("createPromotedApiDeploymentState(config, candidateState)");
		const promoted = candidate.indexOf("promoted = true");
		const snapshot = candidate.lastIndexOf("removeSealedSnapshot(snapshotPath)");
		expect(migrate).toBeGreaterThan(-1);
		expect(wait).toBeGreaterThan(migrate);
		expect(promote).toBeGreaterThan(wait);
		expect(promoted).toBeGreaterThan(promote);
		expect(snapshot).toBeGreaterThan(promoted);
	});

	test("rollback recovery waits before it reports that the previous release was restored", () => {
		const recovery = blockAfter(deploy, "} catch (error) {");
		const redeploy = recovery.indexOf("deployRenderedStack(config, \"rollback recovery\")");
		const wait = recovery.indexOf("waitForRequestedRollingServices(config)");
		const notConverged = recovery.indexOf("rollback recovery did not converge");
		const apiWait = recovery.indexOf("waitForApiSlotHealthy(config, recoveredState.deployment.active_slot)");
		const snapshot = recovery.indexOf("removeSealedSnapshot(snapshotPath)");
		const restored = recovery.indexOf("Previous release was restored");
		expect(redeploy).toBeGreaterThan(-1);
		expect(wait).toBeGreaterThan(redeploy);
		expect(notConverged).toBeGreaterThan(wait);
		expect(apiWait).toBeGreaterThan(notConverged);
		expect(snapshot).toBeGreaterThan(apiWait);
		expect(restored).toBeGreaterThan(snapshot);
	});

	test("the steady path deploys, migrates, then waits", () => {
		const steady = blockAfter(deploy, "if (!promoted) {");
		const deployAt = steady.indexOf("deployRenderedStack(config, \"steady\")");
		const migrate = steady.indexOf("runMiniKmsMigrate(config, renderHelpers.buildRuntimeEnv(config, currentState))");
		const wait = steady.indexOf("waitForRequestedRollingServices(config)");
		expect(deployAt).toBeGreaterThan(-1);
		expect(migrate).toBeGreaterThan(deployAt);
		expect(wait).toBeGreaterThan(migrate);
		const steadyEnd = deploy.indexOf(steady) + steady.length;
		const beforeReplicaWait = deploy.slice(steadyEnd, deploy.indexOf("waitForHealthyServices(config, ["));
		expect(beforeReplicaWait).not.toContain("waitForRequestedRollingServices");
		expect(beforeReplicaWait).not.toContain("runMiniKmsMigrate");
	});
});

import { describe, expect, test } from "bun:test";

import { parseReplicaHealth, unhealthyReplicaLabels } from "./replica-health";

describe("waitForHealthyServices replica parsing", () => {
	test("fixture:minikms-replicas-2-2 treats miniKMS 2/2 as healthy", () => {
		expect(parseReplicaHealth("2/2")).toBe("healthy");
		expect(unhealthyReplicaLabels([
			{ label: "minikms", replicas: "2/2" },
			{ label: "atrium", replicas: "1/1" },
		])).toEqual([]);
	});

	test("a partial miniKMS rollout is not healthy", () => {
		expect(parseReplicaHealth("1/2")).toBe("degraded");
		expect(parseReplicaHealth("0/2")).toBe("degraded");
		expect(unhealthyReplicaLabels([
			{ label: "minikms", replicas: "1/2" },
		])).toEqual(["minikms"]);
	});

	test("zero desired replicas and blank output are missing", () => {
		expect(parseReplicaHealth("0/0")).toBe("missing");
		expect(parseReplicaHealth("")).toBe("missing");
		expect(parseReplicaHealth("running")).toBe("degraded");
	});
});

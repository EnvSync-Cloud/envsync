import { describe, expect, test } from "bun:test";

import { ATRIUM_HEALTHCHECK_TEST, ATRIUM_REPLICAS, MINIKMS_HEALTHCHECK_TEST, MINIKMS_REPLICAS } from "./render";
import {
	ROLLING_INSPECT_FORMAT,
	ROLLING_SETTLE_OBSERVATIONS,
	classifyUpdateState,
	evaluateDataPlaneUpdate,
	evaluateRollingService,
	parseRollingInspect,
	rollingSpecMismatches,
	type ObservedRollingService,
} from "./rolling-update";

const deployStartedAtMs = Date.parse("2026-11-23T01:39:00Z");
const currentUpdate = Date.parse("2026-11-23T01:39:05Z");

function observed(overrides: Partial<ObservedRollingService> = {}): ObservedRollingService {
	return {
		updateState: "completed",
		updateStartedAtMs: currentUpdate,
		replicas: MINIKMS_REPLICAS,
		updateOrder: "start-first",
		updateFailureAction: "rollback",
		rollbackOrder: "start-first",
		rollbackFailureAction: "pause",
		healthTest: [...MINIKMS_HEALTHCHECK_TEST],
		...overrides,
	};
}

function atriumObserved(overrides: Partial<ObservedRollingService> = {}) {
	return observed({
		replicas: ATRIUM_REPLICAS,
		healthTest: [...ATRIUM_HEALTHCHECK_TEST],
		...overrides,
	});
}

describe("rolling update convergence", () => {
	test("classifies completed, in-progress, and rollback states", () => {
		expect(classifyUpdateState("completed")).toBe("completed");
		expect(classifyUpdateState("updating")).toBe("in_progress");
		expect(classifyUpdateState("rollback_started")).toBe("in_progress");
		expect(classifyUpdateState("")).toBe("absent");
		expect(classifyUpdateState("paused")).toBe("failed");
		expect(classifyUpdateState("rollback_paused")).toBe("failed");
		expect(classifyUpdateState("rollback_completed")).toBe("failed");
	});

	test("a completed update with the requested spec is ready", () => {
		expect(ATRIUM_REPLICAS).toBe(1);
		expect(MINIKMS_REPLICAS).toBe(2);
		expect(evaluateRollingService({
			service: "minikms",
			observed: observed(),
			replicaHealth: "healthy",
			deployStartedAtMs,
			settleObservations: 0,
		})).toEqual({ action: "ready" });
		expect(evaluateRollingService({
			service: "atrium",
			observed: atriumObserved(),
			replicaHealth: "healthy",
			deployStartedAtMs,
			settleObservations: 0,
		})).toEqual({ action: "ready" });
	});

	test("in-progress start-first stays pending while replica counts already match", () => {
		const decision = evaluateRollingService({
			service: "atrium",
			observed: atriumObserved({ updateState: "updating" }),
			replicaHealth: "healthy",
			deployStartedAtMs,
			settleObservations: ROLLING_SETTLE_OBSERVATIONS,
		});
		expect(decision).toEqual({ action: "wait", kind: "in_progress" });
		expect(evaluateRollingService({
			service: "minikms",
			observed: observed({ updateState: "rollback_started" }),
			replicaHealth: "healthy",
			deployStartedAtMs,
			settleObservations: 0,
		})).toEqual({ action: "wait", kind: "in_progress" });
	});

	test("rollback and paused updates fail", () => {
		for (const updateState of ["rollback_completed", "rollback_paused", "paused"]) {
			expect(evaluateRollingService({
				service: "minikms",
				observed: observed({ updateState }),
				replicaHealth: "healthy",
				deployStartedAtMs,
				settleObservations: 0,
			})).toEqual({ action: "fail", kind: "rolled_back" });
		}
	});

	test("a rolled-back miniKMS spec fails even when the replica count matches the restored service", () => {
		const rolledBack = observed({
			updateState: "rollback_completed",
			replicas: 1,
			updateOrder: "",
			updateFailureAction: "",
			rollbackOrder: "",
			rollbackFailureAction: "",
			healthTest: [],
		});
		expect(rollingSpecMismatches("minikms", rolledBack).length).toBeGreaterThan(0);
		expect(evaluateRollingService({
			service: "minikms",
			observed: rolledBack,
			replicaHealth: "healthy",
			deployStartedAtMs,
			settleObservations: 0,
		})).toEqual({ action: "fail", kind: "rolled_back" });
	});

	test("a completed update that restored the previous spec fails", () => {
		const previous = atriumObserved({
			replicas: 1,
			updateOrder: "",
			updateFailureAction: "",
			rollbackOrder: "",
			rollbackFailureAction: "",
			healthTest: [],
		});
		expect(rollingSpecMismatches("atrium", previous)).toContain("healthcheck unset");
		expect(evaluateRollingService({
			service: "atrium",
			observed: previous,
			replicaHealth: "healthy",
			deployStartedAtMs,
			settleObservations: 0,
		})).toEqual({ action: "fail", kind: "spec" });
	});

	test("a completed update waits while the new tasks are not healthy yet", () => {
		expect(evaluateRollingService({
			service: "minikms",
			observed: observed(),
			replicaHealth: "degraded",
			deployStartedAtMs,
			settleObservations: 0,
		})).toEqual({ action: "wait", kind: "unhealthy" });
	});

	test("an older completed update does not count until the spec stays matched", () => {
		const stale = observed({ updateStartedAtMs: deployStartedAtMs - 60_000 });
		expect(evaluateRollingService({
			service: "minikms",
			observed: stale,
			replicaHealth: "healthy",
			deployStartedAtMs,
			settleObservations: 0,
		})).toEqual({ action: "wait", kind: "settling" });
		expect(evaluateRollingService({
			service: "minikms",
			observed: stale,
			replicaHealth: "healthy",
			deployStartedAtMs,
			settleObservations: ROLLING_SETTLE_OBSERVATIONS - 1,
		})).toEqual({ action: "ready" });
	});

	test("parses inspect output and ignores a zero update timestamp", () => {
		const line = [
			"completed",
			"2026-11-23T01:39:05Z",
			"2",
			"start-first",
			"rollback",
			"start-first",
			"pause",
			JSON.stringify([...MINIKMS_HEALTHCHECK_TEST]),
		].join("|");
		const parsed = parseRollingInspect(line);
		expect(parsed.replicas).toBe(2);
		expect(parsed.healthTest).toEqual([...MINIKMS_HEALTHCHECK_TEST]);
		expect(parseRollingInspect("rollback_completed|0001-01-01T00:00:00Z|1||||||").updateStartedAtMs).toBeNull();
		expect(ROLLING_INSPECT_FORMAT).toContain("{{if .UpdateStatus}}");
		expect(ROLLING_INSPECT_FORMAT).toContain("{{if .Spec.UpdateConfig}}");
		expect(ROLLING_INSPECT_FORMAT).toContain("{{if .Spec.TaskTemplate.ContainerSpec.Healthcheck}}");
		expect(ROLLING_INSPECT_FORMAT).not.toContain("Entrypoint");
	});

	test("fixture data-plane-old-update-then-new: an older completed update is not this deploy", () => {
		const stale = { updateState: "completed", updateStartedAtMs: deployStartedAtMs - 60_000 };
		expect(evaluateDataPlaneUpdate({
			observed: stale,
			deployStartedAtMs,
			settleObservations: 0,
		})).toEqual({ action: "wait", kind: "settling" });
		expect(evaluateDataPlaneUpdate({
			observed: { updateState: "updating", updateStartedAtMs: currentUpdate },
			deployStartedAtMs,
			settleObservations: 0,
		})).toEqual({ action: "wait", kind: "in_progress" });
		expect(evaluateDataPlaneUpdate({
			observed: { updateState: "completed", updateStartedAtMs: currentUpdate },
			deployStartedAtMs,
			settleObservations: 0,
		})).toEqual({ action: "ready" });
	});

	test("a data-plane service with no new update settles after enough unchanged observations", () => {
		const stale = { updateState: "completed", updateStartedAtMs: deployStartedAtMs - 60_000 };
		expect(evaluateDataPlaneUpdate({
			observed: stale,
			deployStartedAtMs,
			settleObservations: ROLLING_SETTLE_OBSERVATIONS - 1,
		})).toEqual({ action: "ready" });
	});

});

import { describe, expect, test } from "bun:test";

import { ATRIUM_HEALTHCHECK_TEST, ATRIUM_IMAGE, ATRIUM_REPLICAS, MINIKMS_HEALTHCHECK_TEST, MINIKMS_IMAGE, MINIKMS_REPLICAS } from "./render";
import {
	ROLLING_INSPECT_FORMAT,
	ROLLING_SETTLE_OBSERVATIONS,
	classifyUpdateState,
	evaluateDataPlaneUpdate,
	evaluateRollingService,
	imageReferenceMatches,
	parseRollingInspect,
	rollingSpecMismatches,
	type ObservedRollingService,
	type RollingServiceName,
} from "./rolling-update";
import type { ServiceHealth } from "./replica-health";

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
		image: MINIKMS_IMAGE,
		...overrides,
	};
}

function decide(
	service: RollingServiceName,
	serviceObserved: ObservedRollingService,
	extra: { replicaHealth?: ServiceHealth; settleObservations?: number } = {},
) {
	return evaluateRollingService({
		service,
		observed: serviceObserved,
		replicaHealth: extra.replicaHealth ?? "healthy",
		deployStartedAtMs,
		settleObservations: extra.settleObservations ?? 0,
		expectedImage: service === "atrium" ? ATRIUM_IMAGE : MINIKMS_IMAGE,
	});
}

function atriumObserved(overrides: Partial<ObservedRollingService> = {}) {
	return observed({
		replicas: ATRIUM_REPLICAS,
		healthTest: [...ATRIUM_HEALTHCHECK_TEST],
		image: ATRIUM_IMAGE,
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
		expect(decide("minikms", observed())).toEqual({ action: "ready" });
		expect(decide("atrium", atriumObserved())).toEqual({ action: "ready" });
		expect(decide("minikms", observed({ image: `${MINIKMS_IMAGE}@sha256:abc` }))).toEqual({ action: "ready" });
		expect(imageReferenceMatches(`${ATRIUM_IMAGE}@sha256:abc`, ATRIUM_IMAGE)).toBe(true);
		expect(imageReferenceMatches(`${MINIKMS_IMAGE}-old`, MINIKMS_IMAGE)).toBe(false);
		expect(imageReferenceMatches("ghcr.io/example/atrium:latest", "ghcr.io/example/atrium")).toBe(true);
		expect(imageReferenceMatches("ghcr.io/example/atrium:latest@sha256:abc", "ghcr.io/example/atrium")).toBe(true);
		expect(imageReferenceMatches("localhost:5000/atrium:latest", "localhost:5000/atrium")).toBe(true);
		expect(imageReferenceMatches("localhost:5000/atrium:1", "localhost:5000/atrium")).toBe(false);
		expect(decide("atrium", atriumObserved({ image: "ghcr.io/example/atrium:latest" }))).toEqual({ action: "fail", kind: "spec" });
	});

	test("in-progress start-first stays pending while replica counts already match", () => {
		expect(decide("atrium", atriumObserved({ updateState: "updating" }), {
			settleObservations: ROLLING_SETTLE_OBSERVATIONS,
		})).toEqual({ action: "wait", kind: "in_progress" });
		expect(decide("minikms", observed({ updateState: "rollback_started" }))).toEqual({ action: "wait", kind: "in_progress" });
	});

	test("rollback and paused updates fail", () => {
		for (const updateState of ["rollback_completed", "rollback_paused", "paused"]) {
			expect(decide("minikms", observed({ updateState }))).toEqual({ action: "fail", kind: "rolled_back" });
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
		expect(rollingSpecMismatches("minikms", rolledBack, MINIKMS_IMAGE).length).toBeGreaterThan(0);
		expect(decide("minikms", rolledBack)).toEqual({ action: "fail", kind: "rolled_back" });
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
		expect(rollingSpecMismatches("atrium", previous, ATRIUM_IMAGE)).toContain("healthcheck unset");
		expect(decide("atrium", previous)).toEqual({ action: "fail", kind: "spec" });
	});

	test("an untagged Atrium image matches Swarm's latest form", () => {
		const running = atriumObserved({ image: "ghcr.io/example/atrium:latest@sha256:abc" });
		expect(rollingSpecMismatches("atrium", running, "ghcr.io/example/atrium")).toEqual([]);
		expect(evaluateRollingService({
			service: "atrium",
			observed: running,
			replicaHealth: "healthy",
			deployStartedAtMs,
			settleObservations: 0,
			expectedImage: "ghcr.io/example/atrium",
		})).toEqual({ action: "ready" });
	});

	test("a completed update with a different image fails", () => {
		const failedImage = observed({ image: "ghcr.io/envsync-cloud/minikms:sha-failed" });
		expect(rollingSpecMismatches("minikms", failedImage, MINIKMS_IMAGE).join(" ")).toContain("sha-failed");
		expect(decide("minikms", failedImage)).toEqual({ action: "fail", kind: "spec" });
	});

	test("a stale rollback on a different image does not settle", () => {
		const stale = atriumObserved({
			updateState: "rollback_completed",
			updateStartedAtMs: deployStartedAtMs - 60_000,
			image: "ghcr.io/bravo68web/atrium:failed",
		});
		expect(decide("atrium", stale, { settleObservations: ROLLING_SETTLE_OBSERVATIONS })).toEqual({
			action: "wait",
			kind: "spec",
		});
	});

	test("a completed update waits while the new tasks are not healthy yet", () => {
		expect(decide("minikms", observed(), { replicaHealth: "degraded" })).toEqual({ action: "wait", kind: "unhealthy" });
	});

	test("an older completed update does not count until the spec stays matched", () => {
		const stale = observed({ updateStartedAtMs: deployStartedAtMs - 60_000 });
		expect(decide("minikms", stale)).toEqual({ action: "wait", kind: "settling" });
		expect(decide("minikms", stale, { settleObservations: ROLLING_SETTLE_OBSERVATIONS - 1 })).toEqual({ action: "ready" });
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
			`${MINIKMS_IMAGE}@sha256:abc`,
		].join("|");
		const parsed = parseRollingInspect(line);
		expect(parsed.replicas).toBe(2);
		expect(parsed.healthTest).toEqual([...MINIKMS_HEALTHCHECK_TEST]);
		expect(parsed.image).toBe(`${MINIKMS_IMAGE}@sha256:abc`);
		expect(parseRollingInspect("rollback_completed|0001-01-01T00:00:00Z|1||||||").updateStartedAtMs).toBeNull();
		expect(parseRollingInspect("rollback_completed|0001-01-01T00:00:00Z|1||||||").image).toBe("");
		expect(ROLLING_INSPECT_FORMAT).toContain("{{if .UpdateStatus}}");
		expect(ROLLING_INSPECT_FORMAT).toContain("{{if .Spec.UpdateConfig}}");
		expect(ROLLING_INSPECT_FORMAT).toContain("{{if .Spec.TaskTemplate.ContainerSpec.Healthcheck}}");
		expect(ROLLING_INSPECT_FORMAT).toContain("{{if .Spec.TaskTemplate.ContainerSpec.Image}}");
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

	test("a historical rollback without a timestamp does not block a matching service", () => {
		const historical = observed({ updateState: "rollback_completed", updateStartedAtMs: null });
		expect(decide("minikms", historical)).toEqual({ action: "wait", kind: "settling" });
		expect(decide("minikms", historical, { settleObservations: ROLLING_SETTLE_OBSERVATIONS - 1 })).toEqual({
			action: "ready",
		});
	});

	test("a data-plane image that does not match the rendered image does not settle", () => {
		expect(evaluateDataPlaneUpdate({
			observed: { updateState: "completed", updateStartedAtMs: deployStartedAtMs - 60_000 },
			deployStartedAtMs,
			settleObservations: ROLLING_SETTLE_OBSERVATIONS,
			imageMatches: false,
		})).toEqual({ action: "wait", kind: "spec" });
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

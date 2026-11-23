import {
	ATRIUM_HEALTHCHECK_TEST,
	ATRIUM_REPLICAS,
	MINIKMS_HEALTHCHECK_TEST,
	MINIKMS_REPLICAS,
} from "./render";
import type { ServiceHealth } from "./replica-health";

/**
 * Inspect format for one Swarm service.
 * Every optional object is guarded. A task with no healthcheck or update
 * config has no map entry, and an unguarded field fails the whole template.
 */
export const ROLLING_INSPECT_FORMAT = [
	"{{if .UpdateStatus}}{{.UpdateStatus.State}}{{end}}",
	'{{if .UpdateStatus}}{{.UpdateStatus.StartedAt.Format "2006-01-02T15:04:05Z07:00"}}{{end}}',
	"{{if .Spec.Mode.Replicated}}{{.Spec.Mode.Replicated.Replicas}}{{end}}",
	"{{if .Spec.UpdateConfig}}{{.Spec.UpdateConfig.Order}}{{end}}",
	"{{if .Spec.UpdateConfig}}{{.Spec.UpdateConfig.FailureAction}}{{end}}",
	"{{if .Spec.RollbackConfig}}{{.Spec.RollbackConfig.Order}}{{end}}",
	"{{if .Spec.RollbackConfig}}{{.Spec.RollbackConfig.FailureAction}}{{end}}",
	"{{if .Spec.TaskTemplate.ContainerSpec.Healthcheck}}{{json .Spec.TaskTemplate.ContainerSpec.Healthcheck.Test}}{{end}}",
	"{{if .Spec.TaskTemplate.ContainerSpec.Image}}{{.Spec.TaskTemplate.ContainerSpec.Image}}{{end}}",
].join("|");

/** How long a detached deploy may take to reach a terminal update. */
export const ROLLING_UPDATE_WAIT_SECONDS = 300;

/**
 * Identical redeploys do not start a new update. Accept a matching spec only
 * after this many unchanged observations, so a start-first update that has
 * not flipped to "updating" yet is not treated as done.
 */
export const ROLLING_SETTLE_OBSERVATIONS = 5;

/** Daemon clock versus the CLI clock. */
export const ROLLING_CLOCK_SKEW_MS = 5_000;

export type RollingServiceName = "atrium" | "minikms";

export interface ObservedRollingService {
	updateState: string;
	updateStartedAtMs: number | null;
	replicas: number | null;
	updateOrder: string;
	updateFailureAction: string;
	rollbackOrder: string;
	rollbackFailureAction: string;
	healthTest: string[];
	image: string;
}

export type UpdateProgress = "absent" | "in_progress" | "completed" | "failed";

export type RollingDecision =
	| { action: "wait"; kind: "in_progress" | "unhealthy" | "spec" | "settling" }
	| { action: "ready" }
	| { action: "fail"; kind: "rolled_back" | "spec" };

export function classifyUpdateState(state: string | null | undefined): UpdateProgress {
	const value = (state ?? "").trim().toLowerCase();
	if (!value) return "absent";
	if (value === "completed") return "completed";
	if (value === "updating" || value === "rollback_started") return "in_progress";
	if (
		value === "paused"
		|| value === "rollback_paused"
		|| value === "rollback_completed"
		|| value.startsWith("rollback_")
	) {
		return "failed";
	}
	return "in_progress";
}

export function parseDockerTimestamp(value: string | null | undefined): number | null {
	const trimmed = (value ?? "").trim();
	if (!trimmed) return null;
	const normalized = trimmed.replace(/(\.\d{3})\d+/, "$1");
	const ms = Date.parse(normalized);
	if (Number.isNaN(ms)) return null;
	if (new Date(ms).getUTCFullYear() < 2000) return null;
	return ms;
}

export function parseRollingInspect(raw: string): ObservedRollingService {
	const parts = raw.trim().split("|");
	while (parts.length < 9) parts.push("");
	const [
		updateState = "",
		startedAt = "",
		replicas = "",
		updateOrder = "",
		updateFailureAction = "",
		rollbackOrder = "",
		rollbackFailureAction = "",
		healthRaw = "",
		image = "",
	] = parts;
	let healthTest: string[] = [];
	if (healthRaw.trim()) {
		try {
			const parsed = JSON.parse(healthRaw) as unknown;
			if (Array.isArray(parsed) && parsed.every(item => typeof item === "string")) {
				healthTest = parsed;
			}
		} catch {
			healthTest = [];
		}
	}
	return {
		updateState: updateState.trim(),
		updateStartedAtMs: parseDockerTimestamp(startedAt),
		replicas: /^\d+$/.test(replicas.trim()) ? Number(replicas.trim()) : null,
		updateOrder: updateOrder.trim(),
		updateFailureAction: updateFailureAction.trim(),
		rollbackOrder: rollbackOrder.trim(),
		rollbackFailureAction: rollbackFailureAction.trim(),
		healthTest,
		image: image.trim(),
	};
}

/** Swarm may store the requested tag with the resolved digest appended. */
export function imageReferenceMatches(actual: string, expected: string): boolean {
	const observedImage = actual.trim();
	const wanted = expected.trim();
	if (!observedImage || !wanted) return false;
	return observedImage === wanted || observedImage.startsWith(`${wanted}@sha256:`);
}

function sameHealth(actual: string[], expected: readonly string[]) {
	return actual.length === expected.length && actual.every((item, index) => item === expected[index]);
}

/** Differences from the spec this deploy renders. Empty means the service matches. */
export function rollingSpecMismatches(
	service: RollingServiceName,
	observed: ObservedRollingService,
	expectedImage: string,
): string[] {
	const expectedReplicas = service === "atrium" ? ATRIUM_REPLICAS : MINIKMS_REPLICAS;
	const expectedHealth = service === "atrium" ? ATRIUM_HEALTHCHECK_TEST : MINIKMS_HEALTHCHECK_TEST;
	const mismatches: string[] = [];
	if (!imageReferenceMatches(observed.image, expectedImage)) {
		mismatches.push(`image ${observed.image || "unset"} != ${expectedImage}`);
	}
	if (observed.replicas !== expectedReplicas) {
		mismatches.push(`replicas ${observed.replicas ?? "unset"} != ${expectedReplicas}`);
	}
	if (observed.updateOrder !== "start-first") {
		mismatches.push(`update order ${observed.updateOrder || "unset"}`);
	}
	if (observed.updateFailureAction !== "rollback") {
		mismatches.push(`update failure ${observed.updateFailureAction || "unset"}`);
	}
	if (observed.rollbackOrder !== "start-first") {
		mismatches.push(`rollback order ${observed.rollbackOrder || "unset"}`);
	}
	if (observed.rollbackFailureAction !== "pause") {
		mismatches.push(`rollback failure ${observed.rollbackFailureAction || "unset"}`);
	}
	if (!sameHealth(observed.healthTest, expectedHealth)) {
		mismatches.push(`healthcheck ${observed.healthTest.length === 0 ? "unset" : observed.healthTest.join(" ")}`);
	}
	return mismatches;
}

function updateBelongsToDeploy(observed: ObservedRollingService, deployStartedAtMs: number) {
	if (observed.updateStartedAtMs === null) return false;
	return observed.updateStartedAtMs >= deployStartedAtMs - ROLLING_CLOCK_SKEW_MS;
}

/**
 * Decide whether one miniKMS or Atrium service has converged.
 * Replica equality alone is not success: an in-progress start-first update
 * and a rolled-back spec both keep tasks running.
 */
export function evaluateRollingService(input: {
	service: RollingServiceName;
	observed: ObservedRollingService;
	replicaHealth: ServiceHealth;
	deployStartedAtMs: number;
	settleObservations: number;
	expectedImage: string;
}): RollingDecision {
	const progress = classifyUpdateState(input.observed.updateState);
	const belongs = updateBelongsToDeploy(input.observed, input.deployStartedAtMs);
	const mismatches = rollingSpecMismatches(input.service, input.observed, input.expectedImage);
	const healthy = input.replicaHealth === "healthy";

	if (progress === "in_progress") {
		return { action: "wait", kind: "in_progress" };
	}
	if (progress === "failed" && (belongs || input.observed.updateStartedAtMs === null)) {
		return { action: "fail", kind: "rolled_back" };
	}
	if (progress === "completed" && belongs) {
		if (mismatches.length > 0) return { action: "fail", kind: "spec" };
		if (!healthy) return { action: "wait", kind: "unhealthy" };
		return { action: "ready" };
	}
	if (mismatches.length > 0 || !healthy) {
		return { action: "wait", kind: mismatches.length > 0 ? "spec" : "unhealthy" };
	}
	if (input.settleObservations + 1 >= ROLLING_SETTLE_OBSERVATIONS) {
		return { action: "ready" };
	}
	return { action: "wait", kind: "settling" };
}

/**
 * Decide whether a data-plane service update belongs to this detached deploy.
 * An older completed update is not treated as ready until a new update starts
 * and completes, or the current spec stays unchanged long enough to settle.
 */
export function evaluateDataPlaneUpdate(input: {
	observed: Pick<ObservedRollingService, "updateState" | "updateStartedAtMs">;
	deployStartedAtMs: number;
	settleObservations: number;
}): RollingDecision {
	const progress = classifyUpdateState(input.observed.updateState);
	const startedAt = input.observed.updateStartedAtMs;
	const belongs = startedAt !== null && startedAt >= input.deployStartedAtMs - ROLLING_CLOCK_SKEW_MS;

	if (progress === "in_progress") {
		return { action: "wait", kind: "in_progress" };
	}
	if (progress === "failed" && (belongs || startedAt === null)) {
		return { action: "fail", kind: "rolled_back" };
	}
	if (progress === "completed" && belongs) {
		return { action: "ready" };
	}
	if (input.settleObservations + 1 >= ROLLING_SETTLE_OBSERVATIONS) {
		return { action: "ready" };
	}
	return { action: "wait", kind: "settling" };
}

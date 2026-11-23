import { describe, expect, test } from "bun:test";

import {
	DEPLOY_DATA_PLANE_TIMEOUT_SECONDS,
	REDIS_PING_COMMAND,
	deployDataPlaneWaits,
	deployRuntimeWaits,
	pgIsReadyCommand,
	shouldStageInfraFirst,
	waitForLabeledProbes,
} from "./readiness";

describe("startup order readiness", () => {
	test("deploy and restore probe the four databases and Redis for 180s", () => {
		const waits = deployDataPlaneWaits();
		expect(DEPLOY_DATA_PLANE_TIMEOUT_SECONDS).toBe(180);
		expect(waits.map(wait => wait.timeoutSeconds)).toEqual([180, 180, 180, 180, 180]);
		const postgres = waits.filter(wait => wait.kind === "postgres");
		expect(postgres.map(wait => pgIsReadyCommand(wait.host, wait.user))).toEqual([
			"pg_isready -h postgres -U postgres",
			"pg_isready -h atrium_db -U atrium",
			"pg_isready -h openfga_db -U openfga",
			"pg_isready -h minikms_db -U postgres",
		]);
		expect(waits.at(-1)).toEqual({ kind: "redis", timeoutSeconds: 180 });
		expect(REDIS_PING_COMMAND).toBe("redis-cli -h redis ping | grep PONG");
		expect(deployRuntimeWaits().map(wait => wait.label)).toEqual(["atrium", "openfga", "minikms"]);
		expect(deployRuntimeWaits().every(wait => wait.timeoutSeconds === 180)).toBe(true);
	});

	test("cold start stages infra when a data-plane service is absent", () => {
		const present = new Map<string, string>([
			["envsync_postgres", "healthy"],
			["envsync_redis", "healthy"],
			["envsync_atrium_db", "healthy"],
			["envsync_openfga_db", "healthy"],
			["envsync_minikms_db", "healthy"],
		]);
		expect(shouldStageInfraFirst(present, "envsync")).toBe(false);
		present.set("envsync_postgres", "degraded");
		expect(shouldStageInfraFirst(present, "envsync")).toBe(false);
		present.delete("envsync_redis");
		expect(shouldStageInfraFirst(present, "envsync")).toBe(true);
		present.set("envsync_redis", "missing");
		expect(shouldStageInfraFirst(present, "envsync")).toBe(true);
	});

	test("fixture deploy-data-plane-probe-wait: 1/1 replicas do not satisfy a failed probe", () => {
		let now = 0;
		const log: string[] = [];
		const result = waitForLabeledProbes({
			labels: ["postgres database readiness", "redis readiness"],
			timeoutSeconds: 180,
			intervalSeconds: 2,
			now: () => now,
			sleep: seconds => {
				now += seconds * 1000;
			},
			probe: label => {
				const replicaHealthy = true;
				const probeOk = label === "postgres database readiness" ? now >= 30_000 : now >= 60_000;
				log.push(`${label} replicaHealthy=${replicaHealthy} probeOk=${probeOk} t=${now}`);
				return probeOk;
			},
			onPending: (label, elapsedSeconds) => {
				log.push(`pending ${label} elapsed=${elapsedSeconds}`);
			},
		});
		expect(result.status).toBe("ready");
		if (result.status === "ready") {
			expect(result.elapsedMs).toBeGreaterThanOrEqual(60_000);
			expect(result.elapsedMs).toBeLessThanOrEqual(180_000);
		}
		expect(log.some(line => line.includes("probeOk=false") && line.includes("replicaHealthy=true"))).toBe(true);
		expect(log.some(line => line.includes("postgres database readiness replicaHealthy=true probeOk=true"))).toBe(true);
		expect(log.some(line => line.includes("redis readiness replicaHealthy=true probeOk=true"))).toBe(true);
		expect(log.some(line => line.startsWith("pending postgres database readiness"))).toBe(true);
	});

	test("fixture deploy-data-plane-probe-timeout: a failed probe times out at 180s", () => {
		let now = 0;
		let failedProbes = 0;
		const result = waitForLabeledProbes({
			labels: ["postgres database readiness"],
			timeoutSeconds: 180,
			intervalSeconds: 2,
			now: () => now,
			sleep: seconds => {
				now += seconds * 1000;
			},
			probe: () => {
				failedProbes += 1;
				return false;
			},
		});
		expect(result.status).toBe("timeout");
		if (result.status === "timeout") {
			expect(result.elapsedMs).toBeGreaterThanOrEqual(180_000);
			expect(result.elapsedMs).toBeLessThan(182_000);
			expect(result.pending).toEqual(["postgres database readiness"]);
		}
		expect(failedProbes).toBeGreaterThan(1);
	});
});

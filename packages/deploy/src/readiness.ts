/** Deploy and restore readiness probes. Swarm replica counts are not a probe. */

export const DEPLOY_DATA_PLANE_TIMEOUT_SECONDS = 180;

export const DATA_PLANE_SERVICES = ["postgres", "redis", "atrium_db", "openfga_db", "minikms_db"] as const;

export const REDIS_PING_COMMAND = "redis-cli -h redis ping | grep PONG";

export function pgIsReadyCommand(host: string, user: string) {
	return `pg_isready -h ${host} -U ${user}`;
}

export type DeployDataPlaneWait =
	| {
			kind: "postgres";
			label: string;
			host: string;
			user: string;
			password: "main" | "atrium" | "openfga" | "minikms";
			timeoutSeconds: number;
	  }
	| {
			kind: "redis";
			timeoutSeconds: number;
	  };

/** Same probe class as bootstrap, with the deploy/restore timeout from D5. */
export function deployDataPlaneWaits(): DeployDataPlaneWait[] {
	const timeoutSeconds = DEPLOY_DATA_PLANE_TIMEOUT_SECONDS;
	return [
		{ kind: "postgres", label: "postgres", host: "postgres", user: "postgres", password: "main", timeoutSeconds },
		{ kind: "postgres", label: "atrium", host: "atrium_db", user: "atrium", password: "atrium", timeoutSeconds },
		{ kind: "postgres", label: "openfga", host: "openfga_db", user: "openfga", password: "openfga", timeoutSeconds },
		{ kind: "postgres", label: "minikms", host: "minikms_db", user: "postgres", password: "minikms", timeoutSeconds },
		{ kind: "redis", timeoutSeconds },
	];
}

export type DeployRuntimeWait =
	| { kind: "http"; label: string; target: string; timeoutSeconds: number }
	| { kind: "tcp"; label: string; host: string; port: number; timeoutSeconds: number };

export function deployRuntimeWaits(): DeployRuntimeWait[] {
	const timeoutSeconds = DEPLOY_DATA_PLANE_TIMEOUT_SECONDS;
	return [
		{ kind: "http", label: "atrium", target: "http://atrium:8080/health", timeoutSeconds },
		{ kind: "http", label: "openfga", target: "http://openfga:8090/stores", timeoutSeconds },
		{ kind: "tcp", label: "minikms", host: "minikms", port: 50051, timeoutSeconds },
	];
}

/**
 * Cold start and restore have no data-plane services yet, so infra is deployed
 * before runtime. A rolling upgrade already has those services.
 */
export function shouldStageInfraFirst(healthByService: ReadonlyMap<string, string>, stackName: string) {
	return DATA_PLANE_SERVICES.some(service => {
		const health = healthByService.get(`${stackName}_${service}`);
		return health === undefined || health === "missing";
	});
}

export type ProbeWaitResult =
	| { status: "ready"; elapsedMs: number }
	| { status: "timeout"; elapsedMs: number; pending: string[] };

/**
 * Poll probes until each one succeeds or the timeout elapses.
 * A Swarm `1/1` replica count is not an input: callers pass only probe results.
 */
export function waitForLabeledProbes(input: {
	labels: string[];
	timeoutSeconds: number;
	intervalSeconds?: number;
	now?: () => number;
	sleep: (seconds: number) => void;
	probe: (label: string) => boolean;
	onPending?: (label: string, elapsedSeconds: number) => void;
}): ProbeWaitResult {
	const now = input.now ?? Date.now;
	const intervalSeconds = input.intervalSeconds ?? 2;
	const start = now();
	const deadline = start + input.timeoutSeconds * 1000;
	let lastPendingLogAt = start;
	while (true) {
		const pending = input.labels.filter(label => !input.probe(label));
		const elapsedMs = now() - start;
		if (pending.length === 0) {
			return { status: "ready", elapsedMs };
		}
		if (now() >= deadline) {
			return { status: "timeout", elapsedMs: now() - start, pending };
		}
		if (input.onPending && elapsedMs - (lastPendingLogAt - start) >= 10_000) {
			for (const label of pending) input.onPending(label, elapsedMs / 1000);
			lastPendingLogAt = now();
		}
		const remainingMs = deadline - now();
		const sleepSeconds = Math.min(intervalSeconds, Math.max(remainingMs, 0) / 1000);
		input.sleep(sleepSeconds);
	}
}

export type ServiceHealth = "healthy" | "missing" | "degraded";

/** Swarm `{{.Replicas}}` is `current/desired`. `2/2` is healthy. */
export function parseReplicaHealth(raw: string): ServiceHealth {
	const match = raw.match(/^(\d+)\/(\d+)$/);
	if (!match) return raw.trim() ? "degraded" : "missing";
	const current = Number(match[1]);
	const desired = Number(match[2]);
	if (desired === 0) return "missing";
	if (current === desired) return "healthy";
	return "degraded";
}

export interface ReplicaCheck {
	label: string;
	replicas: string;
}

/**
 * Labels still waiting in `waitForHealthyServices`.
 * miniKMS `2/2` is healthy because current and desired match.
 */
export function unhealthyReplicaLabels(checks: ReplicaCheck[]): string[] {
	return checks
		.filter(check => parseReplicaHealth(check.replicas) !== "healthy")
		.map(check => check.label);
}

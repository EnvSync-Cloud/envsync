/** Boot retries and the /health readiness decision. */
import { AsyncLocalStorage } from "node:async_hooks";

import { CacheClient } from "@/libs/cache";
import { DB } from "@/libs/db";
import infoLogs, { LogTypes } from "@/libs/logger";
import { FGAClient } from "@/libs/openfga";

/** Each dependency gets its own budget. D2 requires at least 120 seconds. */
export const BOOT_DEPENDENCY_BUDGET_MS = 120_000;
/** Upper bound for one probe so a hung command cannot consume the whole budget. */
export const BOOT_PROBE_ATTEMPT_MS = 5_000;

const INITIAL_DELAY_MS = 500;
const MAX_DELAY_MS = 8_000;

export type HealthBody = {
	status: "ok!" | "unavailable";
	postgres: "up" | "down";
	openfga?: "up" | "down";
};

export type HealthDecision = {
	status: 200 | 503;
	body: HealthBody;
};

type Probe = () => Promise<boolean>;

type ReadinessOverride = {
	gate?: boolean;
	bootFinished?: boolean;
	postgres?: Probe;
	openfga?: Probe;
};

type Clock = {
	budgetMs?: number;
	attemptTimeoutMs?: number;
	initialDelayMs?: number;
	maxDelayMs?: number;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
	onAttemptTimeout?: () => void;
};

const readinessOverride = new AsyncLocalStorage<ReadinessOverride>();

let startupGateEnabled = false;
let bootFinishedFlag = false;

function defaultSleep(ms: number) {
	return new Promise<void>(resolve => {
		setTimeout(resolve, ms);
	});
}

function safeMessage(err: unknown) {
	const message = err instanceof Error ? err.message : "dependency check failed";
	return message.replace(/\/\/[^@\s]+@/g, "//");
}

export function enableStartupReadinessGate() {
	startupGateEnabled = true;
}

export function markBootFinished() {
	bootFinishedFlag = true;
}

export function resetStartupReadinessForTests() {
	startupGateEnabled = false;
	bootFinishedFlag = false;
}

export function isBootFinishedForTests() {
	return bootFinishedFlag;
}

/** Test-only override that follows the async call, so parallel files keep the real probes. */
export function withReadinessOverride<T>(override: ReadinessOverride, run: () => Promise<T>) {
	return readinessOverride.run(override, run);
}

/**
 * /health is not ok while Postgres is down.
 * With the startup gate on, it also stays unavailable until boot finishes, and then until OpenFGA answers.
 */
export function decideHealth(input: {
	gate: boolean;
	bootFinished: boolean;
	postgres: boolean;
	openfga: boolean | null;
}): HealthDecision {
	const postgres = input.postgres ? "up" : "down";
	if (!input.postgres) {
		return { status: 503, body: { status: "unavailable", postgres } };
	}
	if (input.gate && !input.bootFinished) {
		return { status: 503, body: { status: "unavailable", postgres } };
	}
	if (input.gate && input.bootFinished) {
		if (input.openfga !== true) {
			return { status: 503, body: { status: "unavailable", postgres, openfga: "down" } };
		}
		return { status: 200, body: { status: "ok!", postgres, openfga: "up" } };
	}
	return { status: 200, body: { status: "ok!", postgres } };
}

async function postgresReachable() {
	return DB.ping();
}

async function postgresReadyForBoot() {
	if (!(await DB.ping())) return false;
	try {
		await DB.getInstance();
		return true;
	} catch (err) {
		infoLogs(`Postgres not ready: ${safeMessage(err)}`, LogTypes.ERROR, "BOOT");
		await DB.destroy().catch(() => undefined);
		return false;
	}
}

async function defaultOpenFgaProbe() {
	try {
		const fga = await FGAClient.getInstance();
		return await fga.healthCheck();
	} catch (err) {
		infoLogs(`OpenFGA not ready: ${safeMessage(err)}`, LogTypes.ERROR, "BOOT");
		return false;
	}
}

export async function evaluateReadiness(): Promise<HealthDecision> {
	const override = readinessOverride.getStore();
	const gate = override?.gate ?? startupGateEnabled;
	const bootFinished = override?.bootFinished ?? bootFinishedFlag;
	let postgres = false;
	try {
		postgres = await (override?.postgres ?? postgresReachable)();
	} catch {
		postgres = false;
	}
	let openfga: boolean | null = null;
	if (gate && bootFinished && postgres) {
		try {
			openfga = await (override?.openfga ?? defaultOpenFgaProbe)();
		} catch {
			openfga = false;
		}
	}
	return decideHealth({ gate, bootFinished, postgres, openfga });
}

export async function retryDependency(label: string, probe: Probe, clock: Clock = {}) {
	const budgetMs = clock.budgetMs ?? BOOT_DEPENDENCY_BUDGET_MS;
	const sleep = clock.sleep ?? defaultSleep;
	const now = clock.now ?? Date.now;
	const maxDelayMs = clock.maxDelayMs ?? MAX_DELAY_MS;
	const attemptTimeoutMs = clock.attemptTimeoutMs ?? BOOT_PROBE_ATTEMPT_MS;
	const start = now();
	const deadline = start + budgetMs;
	let delay = clock.initialDelayMs ?? INITIAL_DELAY_MS;
	let attempt = 0;
	while (true) {
		attempt += 1;
		const remaining = deadline - now();
		// A zero bound still runs one instant probe, so a dependency that becomes
		// ready on the deadline counts. A hung probe cannot outlive the budget.
		const bound = remaining > 0 ? Math.min(attemptTimeoutMs, remaining) : 0;
		let ready = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			ready = await Promise.race([
				probe(),
				new Promise<boolean>((_, reject) => {
					timer = setTimeout(() => reject(new Error(`${label} probe timed out`)), bound);
				}),
			]);
		} catch (err) {
			ready = false;
			if (err instanceof Error && err.message.includes("probe timed out")) {
				clock.onAttemptTimeout?.();
			}
		} finally {
			if (timer) clearTimeout(timer);
		}
		if (ready) return;
		if (now() >= deadline) {
			throw new Error(`${label} not ready after ${budgetMs}ms`);
		}
		infoLogs(`${label} not ready (attempt ${attempt}, elapsed ${now() - start}ms)`, LogTypes.LOGS, "BOOT");
		const wait = Math.min(delay, Math.max(deadline - now(), 0));
		if (wait > 0) await sleep(wait);
		delay = Math.min(delay * 2, maxDelayMs);
	}
}

export async function bootApiDependencies(options?: {
	initCache?: boolean;
	postgres?: Probe;
	redis?: Probe;
	openfga?: Probe;
	productionRedis?: boolean;
	markBootFinished?: boolean;
} & Clock) {
	if (options?.initCache !== false) {
		CacheClient.init();
	}
	const clock: Clock = {
		budgetMs: options?.budgetMs,
		attemptTimeoutMs: options?.attemptTimeoutMs,
		initialDelayMs: options?.initialDelayMs,
		maxDelayMs: options?.maxDelayMs,
		sleep: options?.sleep,
		now: options?.now,
		onAttemptTimeout: options?.onAttemptTimeout,
	};
	await retryDependency("Postgres", options?.postgres ?? postgresReadyForBoot, clock);
	const productionRedis = options?.productionRedis ?? CacheClient.env === "production";
	if (productionRedis) {
		await retryDependency("Redis", options?.redis ?? (() => CacheClient.ping()), {
			...clock,
			onAttemptTimeout: () => {
				clock.onAttemptTimeout?.();
				CacheClient.dropRedisClient();
			},
		});
	}
	await retryDependency("OpenFGA", options?.openfga ?? defaultOpenFgaProbe, clock);
	if (options?.markBootFinished !== false) {
		markBootFinished();
	}
	infoLogs("API dependencies are ready", LogTypes.LOGS, "BOOT");
}

export async function bootOrExit(exit: (code: number) => void, boot: () => Promise<void> = () => bootApiDependencies()) {
	try {
		await boot();
	} catch (err) {
		infoLogs(`API boot failed: ${safeMessage(err)}`, LogTypes.ERROR, "BOOT");
		exit(1);
	}
}

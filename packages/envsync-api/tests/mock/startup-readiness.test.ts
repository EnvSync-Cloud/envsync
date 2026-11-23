import { afterEach, beforeAll, describe, expect, test } from "bun:test";

import { createApiApp } from "@/app/factory";
import {
	BOOT_DEPENDENCY_BUDGET_MS,
	bootApiDependencies,
	bootOrExit,
	decideHealth,
	isBootFinishedForTests,
	resetStartupReadinessForTests,
	retryDependency,
	withReadinessOverride,
} from "@/libs/readiness";

afterEach(() => {
	resetStartupReadinessForTests();
});

function fakeClock() {
	let now = 0;
	return {
		now: () => now,
		sleep: async (ms: number) => {
			now += ms;
		},
		elapsed: () => now,
	};
}

describe("startup readiness", () => {
	test("boot budget is at least 120 seconds per dependency", () => {
		expect(BOOT_DEPENDENCY_BUDGET_MS).toBeGreaterThanOrEqual(120_000);
	});

	test("decideHealth never reports ok while postgres is down", () => {
		for (const gate of [false, true]) {
			for (const bootFinished of [false, true]) {
				const decision = decideHealth({
					gate,
					bootFinished,
					postgres: false,
					openfga: true,
				});
				expect(decision.status).toBe(503);
				expect(JSON.stringify(decision.body).includes("ok")).toBe(false);
			}
		}
	});

	test("fixture api-boot-retry-delayed-dependency: ready after a delayed dependency without exiting", async () => {
		const clock = fakeClock();
		let postgresAttempts = 0;
		let exitCode: number | undefined;
		const called: string[] = [];
		await bootOrExit(
			code => {
				exitCode = code;
			},
			() => bootApiDependencies({
				initCache: false,
				productionRedis: true,
				markBootFinished: true,
				budgetMs: BOOT_DEPENDENCY_BUDGET_MS,
				now: clock.now,
				sleep: clock.sleep,
				postgres: async () => {
					postgresAttempts += 1;
					return clock.elapsed() >= 60_000;
				},
				redis: async () => {
					called.push("redis");
					return true;
				},
				openfga: async () => {
					called.push("openfga");
					return true;
				},
			}),
		);
		expect(exitCode).toBeUndefined();
		expect(postgresAttempts).toBeGreaterThan(1);
		expect(clock.elapsed()).toBeGreaterThanOrEqual(60_000);
		expect(clock.elapsed()).toBeLessThan(BOOT_DEPENDENCY_BUDGET_MS);
		expect(called).toEqual(["redis", "openfga"]);
		expect(isBootFinishedForTests()).toBe(true);
	});

	test("each dependency keeps its own 120 second budget", async () => {
		const clock = fakeClock();
		let redisStartedAt: number | undefined;
		await bootApiDependencies({
			initCache: false,
			productionRedis: true,
			markBootFinished: false,
			budgetMs: BOOT_DEPENDENCY_BUDGET_MS,
			now: clock.now,
			sleep: clock.sleep,
			postgres: async () => clock.elapsed() >= BOOT_DEPENDENCY_BUDGET_MS,
			redis: async () => {
				redisStartedAt ??= clock.elapsed();
				return clock.elapsed() - redisStartedAt >= 60_000;
			},
			openfga: async () => true,
		});
		expect(redisStartedAt).toBeGreaterThanOrEqual(BOOT_DEPENDENCY_BUDGET_MS);
		expect(clock.elapsed() - (redisStartedAt ?? 0)).toBeGreaterThanOrEqual(60_000);
		expect(clock.elapsed()).toBeLessThan(BOOT_DEPENDENCY_BUDGET_MS * 3);
	});

	test("fixture api-boot-retry-permanent-failure: timeout exits and skips later probes", async () => {
		const clock = fakeClock();
		const called: string[] = [];
		let exitCode: number | undefined;
		await bootOrExit(
			code => {
				exitCode = code;
			},
			() => bootApiDependencies({
				initCache: false,
				productionRedis: true,
				markBootFinished: true,
				budgetMs: BOOT_DEPENDENCY_BUDGET_MS,
				now: clock.now,
				sleep: clock.sleep,
				postgres: async () => false,
				redis: async () => {
					called.push("redis");
					return true;
				},
				openfga: async () => {
					called.push("openfga");
					return true;
				},
			}),
		);
		expect(exitCode).toBe(1);
		expect(called).toEqual([]);
		expect(clock.elapsed()).toBeGreaterThanOrEqual(BOOT_DEPENDENCY_BUDGET_MS);
		expect(isBootFinishedForTests()).toBe(false);
		await expect(retryDependency("Postgres", async () => false, {
			budgetMs: BOOT_DEPENDENCY_BUDGET_MS,
			now: clock.now,
			sleep: clock.sleep,
		})).rejects.toThrow(`Postgres not ready after ${BOOT_DEPENDENCY_BUDGET_MS}ms`);
	});

	test("a hanging probe is bounded by the remaining boot budget", async () => {
		let attempts = 0;
		await expect(retryDependency("Postgres", () => {
			attempts += 1;
			return new Promise<boolean>(() => undefined);
		}, {
			budgetMs: 700,
			attemptTimeoutMs: 200,
			initialDelayMs: 0,
			maxDelayMs: 0,
		})).rejects.toThrow("Postgres not ready after 700ms");
		expect(attempts).toBeGreaterThan(1);
	});

	test("a later redis probe can recover after a timed-out connect is dropped", async () => {
		let shared: Promise<boolean> | undefined;
		let attempts = 0;
		let dropped = 0;
		await retryDependency("Redis", async () => {
			attempts += 1;
			if (attempts === 1) {
				shared = new Promise<boolean>(() => undefined);
				return shared;
			}
			if (shared) throw new Error("timed-out connect was reused");
			return true;
		}, {
			budgetMs: 700,
			attemptTimeoutMs: 200,
			initialDelayMs: 0,
			maxDelayMs: 0,
			onAttemptTimeout: () => {
				dropped += 1;
				shared = undefined;
			},
		});
		expect(attempts).toBeGreaterThan(1);
		expect(dropped).toBeGreaterThan(0);
	});
});

describe("GET /health", () => {
	let app: Awaited<ReturnType<typeof createApiApp>>;

	beforeAll(async () => {
		app = await createApiApp("core");
	});

	test("fixture api-health-hides-ok-while-postgres-down", async () => {
		await withReadinessOverride({ postgres: async () => false }, async () => {
			const response = await app.request("http://localhost/health");
			expect(response.status).toBe(503);
			const text = await response.text();
			expect(text.includes("ok")).toBe(false);
			const body = JSON.parse(text) as { status: string; postgres: string; surface: string };
			expect(body.status).toBe("unavailable");
			expect(body.postgres).toBe("down");
			expect(body.surface).toBe("core");
		});
	});

	test("startup gate stays unavailable until boot and OpenFGA succeed", async () => {
		await withReadinessOverride({
			gate: true,
			bootFinished: false,
			postgres: async () => true,
		}, async () => {
			const response = await app.request("http://localhost/health");
			expect(response.status).toBe(503);
			expect((await response.text()).includes("ok")).toBe(false);
		});

		await withReadinessOverride({
			gate: true,
			bootFinished: true,
			postgres: async () => true,
			openfga: async () => false,
		}, async () => {
			const response = await app.request("http://localhost/health");
			expect(response.status).toBe(503);
			const body = (await response.json()) as { status: string; openfga?: string };
			expect(body.status).toBe("unavailable");
			expect(body.openfga).toBe("down");
			expect(JSON.stringify(body).includes("ok")).toBe(false);
		});

		await withReadinessOverride({
			gate: true,
			bootFinished: true,
			postgres: async () => true,
			openfga: async () => true,
		}, async () => {
			const response = await app.request("http://localhost/health");
			expect(response.status).toBe(200);
			expect(await response.json()).toMatchObject({
				status: "ok!",
				postgres: "up",
				openfga: "up",
				surface: "core",
			});
		});
	});

	test("reports ok when postgres is reachable and the startup gate is off", async () => {
		const response = await app.request("http://localhost/health");
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			status: "ok!",
			postgres: "up",
			surface: "core",
		});
	});
});

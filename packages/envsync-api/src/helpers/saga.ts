import infoLogs, { LogTypes } from "@/libs/logger";

export interface SagaStep<TCtx> {
	name: string;
	execute: (ctx: TCtx) => Promise<void>;
	compensate?: (ctx: TCtx) => Promise<void>;
}

/**
 * Execute an ordered list of steps with automatic compensation (rollback) on failure.
 * If any step fails, previously completed steps are compensated in reverse order.
 */
export async function runSaga<TCtx>(name: string, ctx: TCtx, steps: SagaStep<TCtx>[]): Promise<void> {
	const completed: SagaStep<TCtx>[] = [];
	for (const step of steps) {
		try {
			await step.execute(ctx);
			completed.push(step);
		} catch (err) {
			infoLogs(
				`Saga "${name}" failed at step "${step.name}": ${err instanceof Error ? err.message : err}`,
				LogTypes.ERROR,
				"Saga",
			);
			// Compensate in reverse order
			for (const done of [...completed].reverse()) {
				if (done.compensate) {
					try {
						await done.compensate(ctx);
					} catch (compErr) {
						infoLogs(
							`Saga "${name}" compensation failed for step "${done.name}": ${compErr instanceof Error ? compErr.message : compErr}`,
							LogTypes.ERROR,
							"Saga",
						);
					}
				}
			}
			throw err;
		}
	}
}

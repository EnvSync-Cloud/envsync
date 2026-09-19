import infoLogs, { LogTypes } from "@/libs/logger";
import { CertificateService } from "@/services/certificate.service";

let workerTimer: ReturnType<typeof setInterval> | null = null;
let isWorkerPassRunning = false;

const WORKER_INTERVAL_MS = 60 * 60 * 1000;

export function startCertificateLifecycleWorker() {
	if (workerTimer) {
		return;
	}
	workerTimer = setInterval(() => {
		void runCertificateLifecyclePass();
	}, WORKER_INTERVAL_MS);
	void runCertificateLifecyclePass();
}

async function runCertificateLifecyclePass() {
	if (isWorkerPassRunning) {
		return;
	}
	isWorkerPassRunning = true;
	try {
		const result = await CertificateService.processLifecycle();
		if (result.expired || result.expiring) {
			infoLogs(
				`Certificate lifecycle: expired=${result.expired} expiring=${result.expiring}`,
				LogTypes.LOGS,
				"CertificateLifecycleWorker",
			);
		}
	} catch (error) {
		infoLogs(
			`Certificate lifecycle worker failed: ${error instanceof Error ? error.message : String(error)}`,
			LogTypes.ERROR,
			"CertificateLifecycleWorker",
		);
	} finally {
		isWorkerPassRunning = false;
	}
}

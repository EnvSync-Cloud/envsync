import { DiagConsoleLogger, DiagLogLevel, diag, metrics } from "@opentelemetry/api";
import { logs } from "@opentelemetry/api-logs";
import infoLogs, { LogTypes } from "@/libs/logger";
import {
	OTLPExporterBase,
	createOtlpNetworkExportDelegate,
	type IExporterTransport,
	type ExportResponse,
	type OtlpSharedConfiguration,
} from "@opentelemetry/otlp-exporter-base";
import { OTLPMetricExporterBase } from "@opentelemetry/exporter-metrics-otlp-http";
import {
	JsonTraceSerializer,
	JsonMetricsSerializer,
	JsonLogsSerializer,
} from "@opentelemetry/otlp-transformer";
import { Resource } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader, MeterProvider } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { W3CTraceContextPropagator, W3CBaggagePropagator, CompositePropagator } from "@opentelemetry/core";

const OTEL_SDK_DISABLED = process.env.OTEL_SDK_DISABLED === "true";

/**
 * Fetch-based OTLP transport for Bun compatibility.
 *
 * The default OTel `node:http` transport fires a spurious `close` event in Bun
 * before `res.on('end')`, causing every export to be reported as
 * "Request timed out" even though the data is delivered. This transport uses
 * Bun-native `fetch` instead, which works correctly.
 */
class FetchTransport implements IExporterTransport {
	constructor(
		private readonly url: string,
		private readonly headers: Record<string, string>,
	) {}

	async send(data: Uint8Array, timeoutMillis: number): Promise<ExportResponse> {
		try {
			const res = await fetch(this.url, {
				method: "POST",
				headers: this.headers,
				body: new TextDecoder().decode(data),
				signal: AbortSignal.timeout(timeoutMillis),
			});

			if (res.ok) {
				return { status: "success", data: new Uint8Array(await res.arrayBuffer()) };
			}

			if (res.status === 429 || res.status >= 500) {
				const retryAfter = res.headers.get("retry-after");
				return {
					status: "retryable",
					retryInMillis: retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
				};
			}

			return {
				status: "failure",
				error: new Error(`OTLP export failed (${res.status}): ${await res.text()}`),
			};
		} catch (err) {
			return {
				status: "failure",
				error: err instanceof Error ? err : new Error(String(err)),
			};
		}
	}

	shutdown(): void {}
}

if (!OTEL_SDK_DISABLED) {
	const diagLevel = process.env.OTEL_DIAG_LEVEL === "WARN" ? DiagLogLevel.WARN : DiagLogLevel.ERROR;
	diag.setLogger(new DiagConsoleLogger(), diagLevel);

	const serviceName = process.env.OTEL_SERVICE_NAME || "envsync-api";
	const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";

	const resource = new Resource({
		"service.name": serviceName,
		"service.version": process.env.npm_package_version || "0.4.0",
		"deployment.environment": process.env.NODE_ENV || "development",
	});

	const sharedConfig: OtlpSharedConfiguration = {
		timeoutMillis: 10_000,
		concurrencyLimit: 50,
		compression: "none",
	};

	const jsonHeaders = { "Content-Type": "application/json" };

	// --- Traces ---
	const traceTransport = new FetchTransport(`${endpoint}/v1/traces`, jsonHeaders);
	const traceDelegate = createOtlpNetworkExportDelegate(sharedConfig, JsonTraceSerializer, traceTransport);
	const traceExporter = new OTLPExporterBase(traceDelegate);
	const tracerProvider = new NodeTracerProvider({ resource });
	tracerProvider.addSpanProcessor(new BatchSpanProcessor(traceExporter, {
		maxExportBatchSize: 512,
		scheduledDelayMillis: 2000,
		maxQueueSize: 4096,
	}));
	tracerProvider.register({
		propagator: new CompositePropagator({
			propagators: [
				new W3CTraceContextPropagator(),
				new W3CBaggagePropagator(),
			],
		}),
	});

	// --- Metrics ---
	const metricTransport = new FetchTransport(`${endpoint}/v1/metrics`, jsonHeaders);
	const metricDelegate = createOtlpNetworkExportDelegate(sharedConfig, JsonMetricsSerializer, metricTransport);
	const metricExporter = new OTLPMetricExporterBase(metricDelegate);
	const meterProvider = new MeterProvider({
		resource,
		readers: [
			new PeriodicExportingMetricReader({
				exporter: metricExporter,
				exportIntervalMillis: 15_000,
			}),
		],
	});
	metrics.setGlobalMeterProvider(meterProvider);

	// --- Logs ---
	const logTransport = new FetchTransport(`${endpoint}/v1/logs`, jsonHeaders);
	const logDelegate = createOtlpNetworkExportDelegate(sharedConfig, JsonLogsSerializer, logTransport);
	const logExporter = new OTLPExporterBase(logDelegate);
	const loggerProvider = new LoggerProvider({ resource });
	loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
	logs.setGlobalLoggerProvider(loggerProvider);

	// Graceful shutdown
	const shutdown = async () => {
		await Promise.allSettled([
			tracerProvider.shutdown(),
			meterProvider.shutdown(),
			loggerProvider.shutdown(),
		]);
	};

	process.on("SIGTERM", shutdown);
	process.on("SIGINT", shutdown);

	infoLogs(`SDK initialized — service=${serviceName}, endpoint=${endpoint}`, LogTypes.LOGS, "OTEL");
} else {
	infoLogs("SDK disabled via OTEL_SDK_DISABLED=true", LogTypes.LOGS, "OTEL");
}

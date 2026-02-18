import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { PeriodicExportingMetricReader, MeterProvider } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { logs } from "@opentelemetry/api-logs";

const OTEL_SDK_DISABLED = process.env.OTEL_SDK_DISABLED === "true";

if (!OTEL_SDK_DISABLED) {
	diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

	const serviceName = process.env.OTEL_SERVICE_NAME || "envsync-api";
	const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";

	const resource = new Resource({
		"service.name": serviceName,
		"service.version": process.env.npm_package_version || "0.4.0",
		"deployment.environment": process.env.NODE_ENV || "development",
	});

	// --- Traces ---
	const traceExporter = new OTLPTraceExporter({
		url: `${endpoint}/v1/traces`,
	});
	const tracerProvider = new NodeTracerProvider({ resource });
	tracerProvider.addSpanProcessor(new BatchSpanProcessor(traceExporter));
	tracerProvider.register();

	// --- Metrics ---
	const metricExporter = new OTLPMetricExporter({
		url: `${endpoint}/v1/metrics`,
	});
	const meterProvider = new MeterProvider({
		resource,
		readers: [
			new PeriodicExportingMetricReader({
				exporter: metricExporter,
				exportIntervalMillis: 15_000,
			}),
		],
	});

	// --- Logs ---
	const logExporter = new OTLPLogExporter({
		url: `${endpoint}/v1/logs`,
	});
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

	console.log(`[OTEL] SDK initialized — service=${serviceName}, endpoint=${endpoint}`);
} else {
	console.log("[OTEL] SDK disabled via OTEL_SDK_DISABLED=true");
}

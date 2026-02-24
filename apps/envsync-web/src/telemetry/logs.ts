import { LoggerProvider, BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { trace, context } from "@opentelemetry/api";
import type { TelemetryConfig } from "./config";

let loggerProvider: LoggerProvider | null = null;

export function initLogs(config: TelemetryConfig): LoggerProvider {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
  });

  const exporter = new OTLPLogExporter({
    url: `${config.endpoint}/v1/logs`,
  });

  loggerProvider = new LoggerProvider({
    resource,
    logRecordProcessors: [new BatchLogRecordProcessor(exporter)],
  });

  interceptConsoleErrors();

  return loggerProvider;
}

function interceptConsoleErrors() {
  const originalError = console.error;

  console.error = (...args: unknown[]) => {
    originalError.apply(console, args);

    if (!loggerProvider) return;

    const logger = loggerProvider.getLogger("console");
    const activeSpan = trace.getSpan(context.active());

    logger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: "ERROR",
      body: args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "),
      attributes: {
        "log.source": "console.error",
        ...(activeSpan
          ? {
              "trace.id": activeSpan.spanContext().traceId,
              "span.id": activeSpan.spanContext().spanId,
            }
          : {}),
      },
    });
  };
}

export function getLoggerProvider(): LoggerProvider | null {
  return loggerProvider;
}

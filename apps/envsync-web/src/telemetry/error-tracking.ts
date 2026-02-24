import { trace, context, SpanStatusCode } from "@opentelemetry/api";
import { SeverityNumber } from "@opentelemetry/api-logs";
import { getLoggerProvider } from "./logs";

export function initErrorTracking(): void {
  window.addEventListener("error", (event) => {
    const activeSpan = trace.getSpan(context.active());
    if (activeSpan) {
      activeSpan.setStatus({ code: SpanStatusCode.ERROR, message: event.message });
      activeSpan.recordException(event.error ?? new Error(event.message));
    }

    const loggerProvider = getLoggerProvider();
    if (loggerProvider) {
      const logger = loggerProvider.getLogger("error-tracking");
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: "ERROR",
        body: event.message,
        attributes: {
          "error.type": "window.error",
          "error.filename": event.filename ?? "",
          "error.lineno": event.lineno ?? 0,
          "error.colno": event.colno ?? 0,
          "error.stack": event.error?.stack ?? "",
        },
      });
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
    const stack = event.reason instanceof Error ? event.reason.stack ?? "" : "";

    const activeSpan = trace.getSpan(context.active());
    if (activeSpan) {
      activeSpan.setStatus({ code: SpanStatusCode.ERROR, message });
      if (event.reason instanceof Error) {
        activeSpan.recordException(event.reason);
      }
    }

    const loggerProvider = getLoggerProvider();
    if (loggerProvider) {
      const logger = loggerProvider.getLogger("error-tracking");
      logger.emit({
        severityNumber: SeverityNumber.ERROR,
        severityText: "ERROR",
        body: message,
        attributes: {
          "error.type": "unhandledrejection",
          "error.stack": stack,
        },
      });
    }
  });
}

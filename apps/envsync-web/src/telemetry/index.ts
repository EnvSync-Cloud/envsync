import { getTelemetryConfig } from "./config";
import { initTracing, getTracerProvider } from "./tracing";
import { initMetrics, getMeterProvider } from "./metrics";
import { initLogs, getLoggerProvider } from "./logs";
import { initErrorTracking } from "./error-tracking";

let initialized = false;

export function initTelemetry(): void {
  const config = getTelemetryConfig();

  if (config.disabled || initialized) return;
  initialized = true;

  initTracing(config);
  initMetrics(config);
  initLogs(config);
  initErrorTracking();

  const shutdown = async () => {
    const promises: Promise<void>[] = [];
    const tracerProvider = getTracerProvider();
    const meterProvider = getMeterProvider();
    const loggerProvider = getLoggerProvider();

    if (tracerProvider) promises.push(tracerProvider.forceFlush());
    if (meterProvider) promises.push(meterProvider.forceFlush());
    if (loggerProvider) promises.push(loggerProvider.forceFlush());

    await Promise.allSettled(promises);
  };

  window.addEventListener("beforeunload", () => {
    shutdown();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      shutdown();
    }
  });
}

export { RouteChangeTracker } from "./route-instrumentation";

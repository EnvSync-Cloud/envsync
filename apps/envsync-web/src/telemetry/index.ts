import { getTelemetryConfig } from "./config";
import { initTracing, getTracerProvider } from "./tracing";
import { initMetrics, getMeterProvider } from "./metrics";
import { initLogs, getLoggerProvider } from "./logs";
import { initErrorTracking } from "./error-tracking";
import { initPostHog } from "./posthog";
import { initSessionReplay } from "./session-replay";

let initialized = false;

export function initTelemetry(): void {
  const config = getTelemetryConfig();

  if (config.disabled || initialized) return;
  initialized = true;

  // HyperDX must init before custom OTel — it bundles its own
  // WebTracerProvider and rrweb recorder. If we register a provider
  // first, HyperDX's OTel layer fails and the recorder errors with
  // "RUM OTEL Web must be inited before recorder".
  initSessionReplay();
  initPostHog();

  // Keep our own browser tracer active even when HyperDX session replay
  // is enabled. HyperDX gives us replay and browser UX tooling, but the
  // explicit OTel provider here guarantees envsync-web service spans and
  // API trace propagation for service-map correlation.
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
export { identifyUser, trackAction } from "./session-replay";

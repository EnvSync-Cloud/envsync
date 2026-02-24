import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { BatchSpanProcessor, SamplingDecision } from "@opentelemetry/sdk-trace-base";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { XMLHttpRequestInstrumentation } from "@opentelemetry/instrumentation-xml-http-request";
import { UserInteractionInstrumentation } from "@opentelemetry/instrumentation-user-interaction";
import { trace } from "@opentelemetry/api";
import type { TelemetryConfig } from "./config";

let provider: WebTracerProvider | null = null;

export function initTracing(config: TelemetryConfig): WebTracerProvider {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
  });

  const exporter = new OTLPTraceExporter({
    url: `${config.endpoint}/v1/traces`,
  });

  provider = new WebTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(exporter)],
    sampler: {
      shouldSample: () => ({
        decision: Math.random() < config.sampleRate
          ? SamplingDecision.RECORD_AND_SAMPLED
          : SamplingDecision.NOT_RECORD,
        attributes: {},
      }),
    },
  });

  provider.register({
    contextManager: new ZoneContextManager(),
  });

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: [new RegExp(apiBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))],
        clearTimingResources: true,
      }),
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: [new RegExp(apiBaseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))],
      }),
      new UserInteractionInstrumentation(),
    ],
  });

  return provider;
}

export function getTracer() {
  return trace.getTracer("envsync-web");
}

export function getTracerProvider(): WebTracerProvider | null {
  return provider;
}

import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { onLCP, onCLS, onINP, onTTFB } from "web-vitals";
import type { TelemetryConfig } from "./config";

let meterProvider: MeterProvider | null = null;

export function initMetrics(config: TelemetryConfig): MeterProvider {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
  });

  const exporter = new OTLPMetricExporter({
    url: `${config.endpoint}/v1/metrics`,
  });

  meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: 30000,
      }),
    ],
  });

  collectWebVitals();

  return meterProvider;
}

function collectWebVitals() {
  if (!meterProvider) return;

  const meter = meterProvider.getMeter("web-vitals");

  const lcpHistogram = meter.createHistogram("web_vitals.lcp", {
    description: "Largest Contentful Paint",
    unit: "ms",
  });

  const clsHistogram = meter.createHistogram("web_vitals.cls", {
    description: "Cumulative Layout Shift",
    unit: "1",
  });

  const inpHistogram = meter.createHistogram("web_vitals.inp", {
    description: "Interaction to Next Paint",
    unit: "ms",
  });

  const ttfbHistogram = meter.createHistogram("web_vitals.ttfb", {
    description: "Time to First Byte",
    unit: "ms",
  });

  onLCP(({ value }) => lcpHistogram.record(value));
  onCLS(({ value }) => clsHistogram.record(value));
  onINP(({ value }) => inpHistogram.record(value));
  onTTFB(({ value }) => ttfbHistogram.record(value));
}

export function getMeterProvider(): MeterProvider | null {
  return meterProvider;
}

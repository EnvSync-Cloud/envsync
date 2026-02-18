import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("envsync-api");

export const httpRequestDuration = meter.createHistogram("http.server.request.duration", {
	description: "Duration of HTTP server requests",
	unit: "ms",
});

export const cacheOperations = meter.createCounter("cache.operations", {
	description: "Number of cache operations",
});

export const externalServiceCalls = meter.createCounter("external.service.calls", {
	description: "Number of external service calls",
});

export const dbQueryDuration = meter.createHistogram("db.query.duration", {
	description: "Duration of database queries",
	unit: "ms",
});

export const appsCreated = meter.createCounter("envsync.apps.created", {
	description: "Total number of apps created",
});

export const variableOperations = meter.createCounter("envsync.variables.operations", {
	description: "Total variable operations (created, encrypted, decrypted)",
});

export const secretOperations = meter.createCounter("envsync.secrets.operations", {
	description: "Total secret operations (created, encrypted, decrypted)",
});

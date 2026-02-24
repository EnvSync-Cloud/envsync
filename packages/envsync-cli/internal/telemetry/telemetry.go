package telemetry

import (
	"context"
	"os"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	sdklog "go.opentelemetry.io/otel/sdk/log"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
)

// version is set via ldflags at build time.
var version = "dev"

const tracerName = "envsync-cli"

// Init initialises OpenTelemetry tracing and logging.
// It returns a shutdown function, the LoggerProvider (for otelzap bridge),
// and any error encountered.
// On failure the returned shutdown is a no-op and lp is nil so callers
// can proceed without telemetry.
func Init(ctx context.Context) (shutdown func(context.Context) error, lp *sdklog.LoggerProvider, err error) {
	noop := func(context.Context) error { return nil }

	if os.Getenv("OTEL_SDK_DISABLED") == "true" {
		return noop, nil, nil
	}

	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = "http://localhost:4318"
	}

	serviceName := os.Getenv("OTEL_SERVICE_NAME")
	if serviceName == "" {
		serviceName = "envsync-cli"
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(serviceName),
			semconv.ServiceVersion(version),
		),
	)
	if err != nil {
		return noop, nil, err
	}

	// Trace exporter
	traceExp, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpoint(stripScheme(endpoint)),
		otlptracehttp.WithInsecure(),
	)
	if err != nil {
		return noop, nil, err
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExp),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	// Log exporter
	logExp, err := otlploghttp.New(ctx,
		otlploghttp.WithEndpoint(stripScheme(endpoint)),
		otlploghttp.WithInsecure(),
	)
	if err != nil {
		// Tracing is usable, logs are not — still return tp shutdown.
		return tp.Shutdown, nil, nil
	}

	lp = sdklog.NewLoggerProvider(
		sdklog.WithProcessor(sdklog.NewBatchProcessor(logExp)),
		sdklog.WithResource(res),
	)

	shutdown = func(ctx context.Context) error {
		_ = lp.Shutdown(ctx)
		return tp.Shutdown(ctx)
	}

	return shutdown, lp, nil
}

// Tracer returns the package-level tracer.
func Tracer() trace.Tracer {
	return otel.Tracer(tracerName)
}

// RecordError records an error on the current span (if any).
func RecordError(ctx context.Context, err error) {
	if err == nil {
		return
	}
	span := trace.SpanFromContext(ctx)
	span.RecordError(err)
	span.SetStatus(codes.Error, err.Error())
}

// stripScheme removes the http:// or https:// prefix for the OTLP HTTP client
// which expects host:port only.
func stripScheme(endpoint string) string {
	for _, prefix := range []string{"https://", "http://"} {
		if len(endpoint) > len(prefix) && endpoint[:len(prefix)] == prefix {
			return endpoint[len(prefix):]
		}
	}
	return endpoint
}

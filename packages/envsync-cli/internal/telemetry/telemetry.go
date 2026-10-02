package telemetry

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"strings"

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

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/config"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/constants"
)

var version = "dev"

const tracerName = "envsync-cli"

func Init(ctx context.Context) (shutdown func(context.Context) error, lp *sdklog.LoggerProvider, err error) {
	noop := func(context.Context) error { return nil }

	if os.Getenv(constants.EnvOTELDisabled) == "true" {
		return noop, nil, nil
	}

	endpoint := os.Getenv(constants.EnvOTELURL)
	if endpoint == "" {
		cfg := config.New()
		endpoint = cfg.OTELConfig.Endpoint
	}
	if endpoint == "" {
		return noop, nil, nil
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

	// WithEndpointURL consumes the path exactly as given and never appends the
	// signal path, so the configured base endpoint must be completed here.
	traceURL, err := signalURL(endpoint, "/v1/traces")
	if err != nil {
		return noop, nil, err
	}
	logURL, err := signalURL(endpoint, "/v1/logs")
	if err != nil {
		return noop, nil, err
	}

	// The URL scheme selects TLS vs. plain HTTP, so WithInsecure is not needed.
	traceExp, err := otlptracehttp.New(ctx, otlptracehttp.WithEndpointURL(traceURL))
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

	logExp, err := otlploghttp.New(ctx, otlploghttp.WithEndpointURL(logURL))
	if err != nil {
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

func Tracer() trace.Tracer {
	return otel.Tracer(tracerName)
}

func RecordError(ctx context.Context, err error) {
	if err == nil {
		return
	}
	span := trace.SpanFromContext(ctx)
	span.RecordError(err)
	span.SetStatus(codes.Error, err.Error())
}

// signalURL joins a configured OTLP endpoint with a signal path such as
// "/v1/traces". WithEndpointURL consumes the path exactly as given and never
// appends the signal path, so the base must be completed here — otherwise
// telemetry is posted to the collector root and any collector mounted under a
// prefix answers 404.
//
// The endpoint is shared by the traces and logs exporters, so it is treated as
// a collector base URL. A trailing signal path is tolerated and stripped
// because both forms appear in config files and in ENVSYNC_TELEMETRY_URL, and
// there is no CLI command to correct the value once it is stored.
func signalURL(base, signal string) (string, error) {
	raw := strings.TrimSpace(base)
	if raw == "" {
		return "", fmt.Errorf("telemetry endpoint is empty")
	}
	// A bare host:port is accepted as plain HTTP, matching WithEndpoint's format.
	if !strings.Contains(raw, "://") {
		raw = "http://" + raw
	}

	u, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("invalid telemetry endpoint %q: %w", base, err)
	}
	if u.Host == "" {
		return "", fmt.Errorf("invalid telemetry endpoint %q: missing host", base)
	}

	u.Path = strings.TrimSuffix(trimSignalPath(u.Path), "/") + signal
	u.RawQuery, u.Fragment = "", ""
	return u.String(), nil
}

// trimSignalPath drops a trailing OTLP signal path so an endpoint may be given
// either as a collector base URL or as a concrete signal URL.
func trimSignalPath(p string) string {
	for _, s := range []string{"/v1/traces", "/v1/logs", "/v1/metrics"} {
		if strings.HasSuffix(p, s) {
			return strings.TrimSuffix(p, s)
		}
	}
	return p
}

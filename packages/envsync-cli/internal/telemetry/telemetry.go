package telemetry

import (
	"context"
	"net/url"
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

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/config"
)

var version = "dev"

const tracerName = "envsync-cli"

func Init(ctx context.Context) (shutdown func(context.Context) error, lp *sdklog.LoggerProvider, err error) {
	noop := func(context.Context) error { return nil }

	if os.Getenv("OTEL_SDK_DISABLED") == "true" {
		return noop, nil, nil
	}

	endpoint := os.Getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
	if endpoint == "" {
		endpoint = os.Getenv("ENVSYNC_TELEMETRY_ENDPOINT")
	}
	if endpoint == "" {
		cfg := config.New()
		endpoint = cfg.TelemetryURL
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

	host, useHTTP := parseEndpoint(endpoint)

	traceOpts := []otlptracehttp.Option{
		otlptracehttp.WithEndpoint(host),
	}
	if useHTTP {
		traceOpts = append(traceOpts, otlptracehttp.WithInsecure())
	}
	traceExp, err := otlptracehttp.New(ctx, traceOpts...)
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

	logOpts := []otlploghttp.Option{
		otlploghttp.WithEndpoint(host),
	}
	if useHTTP {
		logOpts = append(logOpts, otlploghttp.WithInsecure())
	}
	logExp, err := otlploghttp.New(ctx, logOpts...)
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

func parseEndpoint(endpoint string) (host string, insecure bool) {
	if endpoint == "" {
		return "", true
	}

	if len(endpoint) > 8 && endpoint[:8] == "https://" {
		u, err := url.Parse(endpoint)
		if err != nil {
			return endpoint, false
		}
		h := u.Host
		if u.Port() == "" {
			h = h + ":443"
		}
		return h, false
	}

	if len(endpoint) > 7 && endpoint[:7] == "http://" {
		u, err := url.Parse(endpoint)
		if err != nil {
			return endpoint, true
		}
		h := u.Host
		if u.Port() == "" {
			h = h + ":80"
		}
		return h, true
	}

	return endpoint, true
}

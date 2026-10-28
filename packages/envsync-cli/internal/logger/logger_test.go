package logger

import (
	"context"
	"testing"

	"go.opentelemetry.io/otel"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/constants"
)

func TestFromContextWithoutLoggerIsNoop(t *testing.T) {
	l := FromContext(context.Background())
	if l == nil {
		t.Fatal("FromContext returned nil")
	}
	// Must be safe to use and emit nothing anywhere.
	l.Info("must not panic or write")
}

func TestFromContextBindsTraceIDs(t *testing.T) {
	tp := sdktrace.NewTracerProvider()
	prev := otel.GetTracerProvider()
	otel.SetTracerProvider(tp)
	t.Cleanup(func() { otel.SetTracerProvider(prev) })

	ctx, span := tp.Tracer("test").Start(context.Background(), "op")
	defer span.End()

	core, recorded := observer.New(zapcore.InfoLevel)
	ctx = context.WithValue(ctx, constants.LoggerKey, zap.New(core))

	FromContext(ctx).Info("hello")

	entries := recorded.All()
	if len(entries) != 1 {
		t.Fatalf("got %d entries, want 1", len(entries))
	}
	fields := entries[0].ContextMap()
	want := map[string]string{
		"trace_id": span.SpanContext().TraceID().String(),
		"span_id":  span.SpanContext().SpanID().String(),
	}
	for k, v := range want {
		if got, ok := fields[k].(string); !ok || got != v {
			t.Errorf("field %s = %v, want %s", k, fields[k], v)
		}
	}
}

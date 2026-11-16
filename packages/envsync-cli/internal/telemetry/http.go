package telemetry

import (
	"net/http"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.uber.org/zap"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/logger"
)

// NewInstrumentedTransport wraps base with OTEL HTTP client spans plus one log
// record per API call. All repository traffic funnels through the client
// constructors in internal/repository, so the repository layer needs no
// per-method instrumentation: every present and future repository call is
// covered here. The span carries method, URL, and status and already marks
// 4xx/5xx and transport failures as errors (otelhttp); this wrapper adds the
// log trail that ties each call to the command's trace via trace_id.
//
// Log records deliberately carry only method, path, status, and duration:
// query strings, headers, and request/response bodies (tokens, secret values)
// never reach logs or span attributes. The span name is "METHOD /path" — a CLI
// has no route templates, and the bounded API surface makes the cardinality
// cost worth the debuggability.
func NewInstrumentedTransport(base http.RoundTripper) http.RoundTripper {
	return otelhttp.NewTransport(&loggedTransport{base: base},
		otelhttp.WithSpanNameFormatter(func(_ string, r *http.Request) string {
			return r.Method + " " + r.URL.Path
		}),
	)
}

type loggedTransport struct {
	base http.RoundTripper
}

func (t *loggedTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	start := time.Now()
	resp, err := t.base.RoundTrip(req)

	// req.Context() carries the CLI logger and the otelhttp span started for
	// this call, so the record lands in the log file and the OTEL logs with
	// the trace that caused it.
	l := logger.FromContext(req.Context())
	fields := []zap.Field{
		zap.String("method", req.Method),
		zap.String("path", req.URL.Path),
		zap.Duration("duration", time.Since(start)),
	}

	if err != nil {
		l.Error("api call failed", append(fields, zap.Error(err))...)
		return resp, err
	}

	fields = append(fields, zap.Int("status", resp.StatusCode))
	switch {
	case resp.StatusCode >= 500:
		l.Error("api call failed", fields...)
	case resp.StatusCode >= 400:
		l.Warn("api call rejected", fields...)
	default:
		l.Info("api call", fields...)
	}
	return resp, err
}

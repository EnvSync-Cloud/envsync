package telemetry

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"go.uber.org/zap/zaptest/observer"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/constants"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func runWithLogs(t *testing.T, rt http.RoundTripper, req *http.Request) *observer.ObservedLogs {
	t.Helper()
	core, recorded := observer.New(zapcore.InfoLevel)
	ctx := context.WithValue(req.Context(), constants.LoggerKey, zap.New(core))
	resp, err := rt.RoundTrip(req.WithContext(ctx))
	if err == nil {
		resp.Body.Close()
	}
	return recorded
}

// The transport is the repository layer's only instrumentation: its records
// must identify the call and its outcome without leaking the query string,
// headers, or bodies (tokens, secret values).
func TestLoggedTransportRecordsCallWithoutSecrets(t *testing.T) {
	rt := NewInstrumentedTransport(roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return httptest.NewRecorder().Result(), nil
	}))

	logs := runWithLogs(t, rt, httptest.NewRequest("GET", "http://api.test/api/app?token=supersecret", nil))

	entries := logs.All()
	if len(entries) != 1 {
		t.Fatalf("got %d log entries, want 1", len(entries))
	}
	if entries[0].Level != zapcore.InfoLevel {
		t.Errorf("level = %v, want Info", entries[0].Level)
	}
	fields := entries[0].ContextMap()
	if fields["method"] != "GET" || fields["path"] != "/api/app" {
		t.Errorf("call fields = %v, want method GET and path /api/app", fields)
	}
	for _, v := range fields {
		if s, ok := v.(string); ok && strings.Contains(s, "supersecret") {
			t.Errorf("log field %v leaks the query string", v)
		}
	}
}

func TestLoggedTransportLevels(t *testing.T) {
	cases := []struct {
		name  string
		rt    http.RoundTripper
		level zapcore.Level
		msg   string
	}{
		{
			name:  "5xx logs at error",
			rt:    roundTripFunc(func(*http.Request) (*http.Response, error) { return responseWithStatus(503), nil }),
			level: zapcore.ErrorLevel,
			msg:   "api call failed",
		},
		{
			name:  "4xx logs at warn",
			rt:    roundTripFunc(func(*http.Request) (*http.Response, error) { return responseWithStatus(401), nil }),
			level: zapcore.WarnLevel,
			msg:   "api call rejected",
		},
		{
			name:  "transport failure logs at error",
			rt:    roundTripFunc(func(*http.Request) (*http.Response, error) { return nil, errors.New("dial refused") }),
			level: zapcore.ErrorLevel,
			msg:   "api call failed",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			logs := runWithLogs(t, NewInstrumentedTransport(tc.rt), httptest.NewRequest("GET", "http://api.test/api/app", nil))
			entries := logs.All()
			if len(entries) != 1 {
				t.Fatalf("got %d log entries, want 1", len(entries))
			}
			if entries[0].Level != tc.level || entries[0].Message != tc.msg {
				t.Errorf("got %s/%q, want %s/%q", entries[0].Level, entries[0].Message, tc.level, tc.msg)
			}
		})
	}
}

func responseWithStatus(status int) *http.Response {
	rec := httptest.NewRecorder()
	rec.Code = status
	return rec.Result()
}

package telemetry

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/constants"
)

func TestSignalURL(t *testing.T) {
	tests := []struct {
		name   string
		base   string
		signal string
		want   string
	}{
		{
			name:   "collector mounted under a prefix keeps that prefix",
			base:   "https://t.envsync.cloud/obs",
			signal: "/v1/traces",
			want:   "https://t.envsync.cloud/obs/v1/traces",
		},
		{
			name:   "trailing slash on the base is normalized away",
			base:   "https://t.envsync.cloud/obs/",
			signal: "/v1/traces",
			want:   "https://t.envsync.cloud/obs/v1/traces",
		},
		{
			name:   "bare origin gets just the signal path",
			base:   "https://t.envsync.cloud",
			signal: "/v1/traces",
			want:   "https://t.envsync.cloud/v1/traces",
		},
		{
			name:   "logs signal path",
			base:   "https://t.envsync.cloud/obs",
			signal: "/v1/logs",
			want:   "https://t.envsync.cloud/obs/v1/logs",
		},
		{
			name:   "explicit http scheme is preserved",
			base:   "http://localhost:4318",
			signal: "/v1/traces",
			want:   "http://localhost:4318/v1/traces",
		},
		{
			name:   "bare host:port is treated as plain http",
			base:   "localhost:4318",
			signal: "/v1/traces",
			want:   "http://localhost:4318/v1/traces",
		},
		{
			name:   "query and fragment are dropped",
			base:   "https://t.envsync.cloud/obs?x=1#frag",
			signal: "/v1/traces",
			want:   "https://t.envsync.cloud/obs/v1/traces",
		},
		{
			name:   "endpoint already carrying the traces path is not double-suffixed",
			base:   "https://t.envsync.cloud/obs/v1/traces",
			signal: "/v1/traces",
			want:   "https://t.envsync.cloud/obs/v1/traces",
		},
		{
			name:   "logs derived from an endpoint carrying the traces path",
			base:   "https://t.envsync.cloud/obs/v1/traces",
			signal: "/v1/logs",
			want:   "https://t.envsync.cloud/obs/v1/logs",
		},
		{
			name:   "endpoint already carrying the logs path",
			base:   "https://t.envsync.cloud/obs/v1/logs",
			signal: "/v1/traces",
			want:   "https://t.envsync.cloud/obs/v1/traces",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := signalURL(tc.base, tc.signal)
			if err != nil {
				t.Fatalf("signalURL(%q, %q) failed: %v", tc.base, tc.signal, err)
			}
			if got != tc.want {
				t.Errorf("signalURL(%q, %q) = %q, want %q", tc.base, tc.signal, got, tc.want)
			}
		})
	}
}

func TestSignalURLRejectsUnusableEndpoints(t *testing.T) {
	for _, base := range []string{"", "   ", "https://", "://nope"} {
		if got, err := signalURL(base, "/v1/traces"); err == nil {
			t.Errorf("signalURL(%q) = %q, want an error", base, got)
		}
	}
}

// Regression: parseEndpoint returned only u.Host, so a base endpoint carrying a
// path prefix (https://host/obs) had that prefix stripped and spans were posted
// to /v1/traces instead of /obs/v1/traces — every export failed with 404.
//
// Both accepted endpoint forms must land on the same request path: appending the
// signal path to an endpoint that already ends in it produced
// /obs/v1/traces/v1/traces, which is a 404 as well.
func TestInitPostsTracesToConfiguredPath(t *testing.T) {
	forms := map[string]string{
		"collector base URL":         "/obs",
		"concrete traces signal URL": "/obs/v1/traces",
	}

	for name, suffix := range forms {
		t.Run(name, func(t *testing.T) {
			var mu sync.Mutex
			var paths []string

			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				mu.Lock()
				paths = append(paths, r.URL.Path)
				mu.Unlock()
				w.WriteHeader(http.StatusOK)
			}))
			defer server.Close()

			t.Setenv(constants.EnvOTELDisabled, "")
			t.Setenv(constants.EnvOTELURL, server.URL+suffix)

			shutdown, _, err := Init(context.Background())
			if err != nil {
				t.Fatalf("Init() failed: %v", err)
			}

			_, span := Tracer().Start(context.Background(), "test-span")
			span.End()

			if err := shutdown(context.Background()); err != nil {
				t.Fatalf("shutdown() failed: %v", err)
			}

			mu.Lock()
			defer mu.Unlock()
			if len(paths) == 0 {
				t.Fatal("no export request reached the collector")
			}
			for _, p := range paths {
				if p != "/obs/v1/traces" {
					t.Errorf("export posted to %q, want %q (full set: %v)", p, "/obs/v1/traces", paths)
				}
			}
		})
	}
}

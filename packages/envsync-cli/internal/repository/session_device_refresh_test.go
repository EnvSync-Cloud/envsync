package repository

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/config"
)

func TestRefreshAuthReturnsRotatedCredentials(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/oauth/token" {
			t.Errorf("unexpected path %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"access_token":"refreshed-access","refresh_token":"rotated-refresh","expires_in":3600,"token_type":"DPoP"}`))
	}))
	t.Cleanup(server.Close)

	fresh, err := refreshAuth(config.AuthConfig{
		AccessToken:  "previous-access",
		RefreshToken: "previous-refresh",
		ClientID:     "envsync-cli",
		TokenURL:     server.URL + "/oauth/token",
	}, time.Now())
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if fresh.AccessToken != "refreshed-access" || fresh.RefreshToken != "rotated-refresh" {
		t.Fatal("rotated credentials were not returned")
	}
}

func TestResolveTokenRetriesPendingDeviceRegistration(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	var registerCalls int
	var tokenCalls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/oauth/token":
			tokenCalls++
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token":"refreshed-access","refresh_token":"rotated-refresh","expires_in":3600,"token_type":"DPoP"}`))
		case "/api/access/cli/session":
			registerCalls++
			if registerCalls == 1 {
				w.WriteHeader(http.StatusServiceUnavailable)
				return
			}
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"registered":true}`))
		default:
			t.Errorf("unexpected path %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)

	now := time.Now()
	cfg := config.AppConfig{
		BackendURL: server.URL,
		AuthConfig: config.AuthConfig{
			AccessToken:  "previous-access",
			RefreshToken: "previous-refresh",
			ExpiresAt:    int(now.Add(-time.Hour).Unix()),
			ClientID:     "envsync-cli",
			TokenURL:     server.URL + "/oauth/token",
		},
	}

	if got := resolveToken(cfg, now); got != "previous-access" {
		t.Fatalf("first resolve returned %q", got)
	}
	stored, err := config.ReadConfigFile()
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	if stored.AuthConfig.AccessToken != "refreshed-access" || stored.AuthConfig.RefreshToken != "rotated-refresh" {
		t.Fatal("rotated credentials were not stored")
	}
	if !stored.AuthConfig.DeviceRegistrationPending {
		t.Fatal("stored session is not pending device registration")
	}

	if got := resolveToken(stored, now); got != "refreshed-access" {
		t.Fatalf("second resolve returned %q", got)
	}
	stored, err = config.ReadConfigFile()
	if err != nil {
		t.Fatalf("read config after retry: %v", err)
	}
	if stored.AuthConfig.DeviceRegistrationPending {
		t.Fatal("pending device registration was not cleared")
	}
	if tokenCalls != 1 {
		t.Fatalf("token endpoint calls = %d", tokenCalls)
	}
	if registerCalls != 2 {
		t.Fatalf("device registration calls = %d", registerCalls)
	}
}

func TestResolveTokenDoesNotRetryRejectedRegistration(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	var registerCalls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/oauth/token":
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"access_token":"refreshed-access","refresh_token":"rotated-refresh","expires_in":3600,"token_type":"DPoP"}`))
		case "/api/access/cli/session":
			registerCalls++
			w.WriteHeader(http.StatusUnauthorized)
		default:
			t.Errorf("unexpected path %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)

	now := time.Now()
	cfg := config.AppConfig{
		BackendURL: server.URL,
		AuthConfig: config.AuthConfig{
			AccessToken:  "previous-access",
			RefreshToken: "previous-refresh",
			ExpiresAt:    int(now.Add(-time.Hour).Unix()),
			ClientID:     "envsync-cli",
			TokenURL:     server.URL + "/oauth/token",
		},
	}

	if got := resolveToken(cfg, now); got != "previous-access" {
		t.Fatalf("first resolve returned %q", got)
	}
	stored, err := config.ReadConfigFile()
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	if stored.AuthConfig.AccessToken != "refreshed-access" || stored.AuthConfig.RefreshToken != "rotated-refresh" {
		t.Fatal("rotated credentials were not stored")
	}
	if stored.AuthConfig.DeviceRegistrationPending {
		t.Fatal("rejected registration stayed pending")
	}

	if got := resolveToken(stored, now); got != "refreshed-access" {
		t.Fatalf("second resolve returned %q", got)
	}
	if registerCalls != 1 {
		t.Fatalf("device registration calls = %d", registerCalls)
	}
}

package repository

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRegisterDeviceSessionPostsProofBeforeLaterRequests(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	const accessToken = "cli-access-token"
	var seenAuthorization string
	var seenProof string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/access/cli/session" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if r.Method != http.MethodPost {
			t.Errorf("method = %s", r.Method)
		}
		seenAuthorization = r.Header.Get("Authorization")
		seenProof = r.Header.Get("DPoP")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"registered":true}`))
	}))
	t.Cleanup(server.Close)

	if err := RegisterDeviceSession(context.Background(), server.URL, accessToken); err != nil {
		t.Fatalf("register device session: %v", err)
	}
	if seenAuthorization != "DPoP "+accessToken {
		t.Fatalf("authorization = %q", seenAuthorization)
	}
	claims := decodeProofPayload(t, seenProof)
	if claims["htu"] != server.URL+"/api/access/cli/session" {
		t.Fatalf("proof htu = %#v", claims["htu"])
	}
	if claims["htm"] != "POST" {
		t.Fatalf("proof htm = %#v", claims["htm"])
	}
	ath, _ := claims["ath"].(string)
	if ath == "" {
		t.Fatal("proof ath is empty")
	}
}

func TestRegisterDeviceSessionRejectsNonSuccess(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"code":"DPOP_REVOKED"}`))
	}))
	t.Cleanup(server.Close)

	err := RegisterDeviceSession(context.Background(), server.URL, "cli-access-token")
	if err == nil {
		t.Fatal("expected registration failure")
	}
	if strings.Contains(err.Error(), "cli-access-token") {
		t.Fatal("registration error included the access token")
	}
	if !strings.Contains(err.Error(), "401") {
		t.Fatalf("error = %v", err)
	}
}

func TestRegisterDeviceSessionRequiresToken(t *testing.T) {
	if err := RegisterDeviceSession(context.Background(), "http://api.example", " "); err == nil {
		t.Fatal("expected missing token to fail before a request")
	}
}

func decodeProofPayload(t *testing.T, proof string) map[string]any {
	t.Helper()
	parts := strings.Split(proof, ".")
	if len(parts) != 3 {
		t.Fatalf("proof parts = %d", len(parts))
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		t.Fatalf("decode proof payload: %v", err)
	}
	var claims map[string]any
	if err := json.Unmarshal(raw, &claims); err != nil {
		t.Fatalf("proof payload: %v", err)
	}
	return claims
}

package config

import (
	"context"
	"path/filepath"
	"testing"

	appconfig "github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/config"
)

// isolateConfig points config.json at a throwaway HOME so tests never touch the
// developer's real configuration.
func isolateConfig(t *testing.T, cfg appconfig.AppConfig) {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	if err := cfg.WriteConfigFile(); err != nil {
		t.Fatalf("WriteConfigFile() failed: %v", err)
	}
}

// Regression: key presence was derived from the value, so a false boolean or an
// empty string was indistinguishable from an unknown key. `config get
// otel_config.disabled --json` printed nothing at all, and unset strings were
// reported as "key not found".
func TestGetConfigResolvesKeysIndependentlyOfValue(t *testing.T) {
	isolateConfig(t, appconfig.AppConfig{
		BackendURL: "https://api.envsync.cloud",
		OTELConfig: appconfig.OTELConfig{
			OtelDisabled: false,
			Endpoint:     "",
			ServiceName:  "",
		},
	})

	uc := NewGetConfigUseCase()
	resp, err := uc.Execute(context.Background(), GetConfigRequest{
		Keys: []string{
			"backend_url",
			"otel_config.disabled",
			"otel_config.service_name",
			"otel_config.endpoint",
		},
	})
	if err != nil {
		t.Fatalf("Execute() failed: %v", err)
	}

	want := map[string]string{
		"backend_url":              "https://api.envsync.cloud",
		"otel_config.disabled":     "false",
		"otel_config.service_name": "",
		"otel_config.endpoint":     "",
	}

	for key, wantVal := range want {
		got, ok := resp.Values[key]
		if !ok {
			t.Errorf("key %q was dropped from the result although it is a known key", key)
			continue
		}
		if got != wantVal {
			t.Errorf("key %q = %q, want %q", key, got, wantVal)
		}
	}

	if len(resp.Values) != len(want) {
		t.Errorf("got %d keys, want %d: %v", len(resp.Values), len(want), resp.Values)
	}
}

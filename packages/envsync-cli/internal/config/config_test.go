package config

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/constants"
)

// isolateConfigDir points the config lookup at a throwaway HOME/XDG root and
// returns the resolved config.json path. Works on both darwin (Application
// Support) and Unix (~/.config) without hardcoding either.
func isolateConfigDir(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	t.Setenv("APPDATA", t.TempDir())

	path, err := configFilePath()
	if err != nil {
		t.Fatalf("configFilePath() failed: %v", err)
	}
	return path
}

// Regression: WriteConfigFile used to call os.WriteFile without MkdirAll, so
// the first write on a fresh machine failed with ENOENT and no config.json was
// ever produced.
func TestWriteConfigFileCreatesMissingDirectory(t *testing.T) {
	path := isolateConfigDir(t)

	cfg := DefaultConfig()
	cfg.AuthConfig.AccessToken = "token-value"
	if err := cfg.WriteConfigFile(); err != nil {
		t.Fatalf("WriteConfigFile() failed on a fresh machine: %v", err)
	}

	if _, err := os.Stat(path); err != nil {
		t.Fatalf("config.json was not created at %s: %v", path, err)
	}

	got, err := ReadConfigFile()
	if err != nil {
		t.Fatalf("ReadConfigFile() failed: %v", err)
	}
	if got.AuthConfig.AccessToken != "token-value" {
		t.Errorf("access_token round-trip: got %q, want %q", got.AuthConfig.AccessToken, "token-value")
	}
}

// Every field of the nested schema must survive a write/read round-trip. This
// pins the JSON tags: renaming or dropping one would otherwise silently detach
// that field from config.json without any compile error.
func TestConfigJSONRoundTrip(t *testing.T) {
	isolateConfigDir(t)

	want := AppConfig{
		BackendURL: "https://new.example",
		AuthConfig: AuthConfig{
			AccessToken:  "NEW",
			RefreshToken: "REFRESH",
			ExpiresAt:    1735689600,
			ClientID:     "cli-client",
			TokenURL:     "https://idp.example/token",
		},
		OTELConfig: OTELConfig{
			OtelDisabled: true,
			Endpoint:     "https://new-t.example",
			ServiceName:  "svc",
		},
	}

	if err := want.WriteConfigFile(); err != nil {
		t.Fatalf("WriteConfigFile() failed: %v", err)
	}

	got, err := ReadConfigFile()
	if err != nil {
		t.Fatalf("ReadConfigFile() failed: %v", err)
	}

	if got != want {
		t.Errorf("round-trip mismatch:\n got  %+v\n want %+v", got, want)
	}
}

func TestEnvsyncAPIURLOverridesSavedBackend(t *testing.T) {
	t.Setenv(constants.EnvBackendURL, "")
	t.Setenv("ENVSYNC_API_URL", "http://e2e.local")

	got := overrideConfigWithEnv(AppConfig{BackendURL: "https://invalid.example.test"})
	if got.BackendURL != "http://e2e.local" {
		t.Fatalf("backend URL = %q, want ENVSYNC_API_URL", got.BackendURL)
	}
}

func TestDefaultBackendURLUsesLinkerVariable(t *testing.T) {
	if got := DefaultConfig().BackendURL; got != backendURL {
		t.Fatalf("DefaultConfig backend URL = %q, want linker value %q", got, backendURL)
	}
}

func TestReadConfigFileEmptyFallsBackToDefaults(t *testing.T) {
	path := isolateConfigDir(t)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, nil, 0o644); err != nil {
		t.Fatal(err)
	}

	got, err := ReadConfigFile()
	if err != nil {
		t.Fatalf("ReadConfigFile() failed: %v", err)
	}
	if want := DefaultConfig().BackendURL; got.BackendURL != want {
		t.Errorf("empty file backend_url: got %q, want %q", got.BackendURL, want)
	}
}

func TestWriteConfigFileFailedUpdateKeepsSavedCredentials(t *testing.T) {
	path := isolateConfigDir(t)
	cfg := DefaultConfig()
	cfg.AuthConfig.AccessToken = "saved-token"
	cfg.AuthConfig.RefreshToken = "saved-refresh"
	if err := cfg.WriteConfigFile(); err != nil {
		t.Fatalf("initial write: %v", err)
	}
	before, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if info.Mode().Perm() != 0o600 {
			t.Fatalf("config mode = %o, want 600", info.Mode().Perm())
		}
	}

	dir := filepath.Dir(path)
	if err := os.Chmod(dir, 0o555); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = os.Chmod(dir, 0o755)
	})

	cfg.AuthConfig.AccessToken = "replacement-token"
	if err := cfg.WriteConfigFile(); err == nil {
		t.Fatal("expected the update to fail before replacing the config")
	}
	after, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(after) != string(before) {
		t.Fatal("failed update changed the saved config")
	}
	leftovers, err := filepath.Glob(filepath.Join(dir, ".config.json-*.tmp"))
	if err != nil {
		t.Fatal(err)
	}
	if len(leftovers) != 0 {
		t.Fatalf("temporary config files left behind: %v", leftovers)
	}
}

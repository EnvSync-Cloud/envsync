package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/constants"
)

type AppConfig struct {
	BackendURL string     `json:"backend_url"`
	AuthConfig AuthConfig `json:"auth_config"`
	OTELConfig OTELConfig `json:"otel_config"`
}

type AuthConfig struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int    `json:"expires_at"`
	// ClientID and TokenURL identify the authorization server endpoint that
	// issues tokens. They arrive with the device-code response and are needed
	// again for the refresh grant.
	ClientID string `json:"client_id"`
	TokenURL string `json:"token_url"`
	// DeviceRegistrationPending is true when refreshed credentials were stored
	// before the device row was recorded. The next command records the device
	// before using that access token.
	DeviceRegistrationPending bool `json:"device_registration_pending,omitempty"`
}

type OTELConfig struct {
	OtelDisabled bool   `json:"disabled"`
	Endpoint     string `json:"endpoint"`
	ServiceName  string `json:"service_name"`
}

// configFilePath resolves the single on-disk location of config.json.
func configFilePath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("failed to get user config directory: %w", err)
	}
	return filepath.Join(configDir, "envsync", "config.json"), nil
}

var (
	cfg     AppConfig
	once    sync.Once
	initErr error
	// backendURL is the default API origin. The E2E harness overrides it with
	// -X github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/config.backendURL=...
	backendURL = constants.BackendURL
)

func New() AppConfig {
	cfg, err := NewWithError()
	if err != nil {
		// Log to stderr but return partial config for backward compatibility.
		fmt.Fprintf(os.Stderr, "warning: config initialization failed: %v\n", err)
	}
	return cfg
}

func NewWithError() (AppConfig, error) {
	once.Do(func() {
		filePath, err := configFilePath()
		if err != nil {
			initErr = err
			return
		}

		// Create the file with defaults if it doesn't exist yet.
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			defaults := DefaultConfig()
			if err := defaults.WriteConfigFile(); err != nil {
				initErr = fmt.Errorf("failed to create config file: %w", err)
				return
			}
		}

		// Read config from file
		cfg, initErr = ReadConfigFile()
		if initErr != nil {
			return
		}

		cfg = overrideConfigWithEnv(cfg)
	})

	return cfg, initErr
}

func (c *AppConfig) WriteConfigFile() error {
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	filePath, err := configFilePath()
	if err != nil {
		return err
	}

	// The config directory may not exist yet on a fresh machine; the caller
	// should never have to bootstrap it before persisting.
	if err := os.MkdirAll(filepath.Dir(filePath), 0o755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	// Replace the file only after the temporary write is durable. A failed
	// update leaves the previous credentials in place.
	if err := writeFileAtomic(filePath, data, 0o600); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}
	return nil
}

// writeFileAtomic writes data to a temporary file in the destination directory
// and renames it over path. The rename is the only step that replaces path.
func writeFileAtomic(path string, data []byte, mode os.FileMode) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, ".config.json-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	cleanup := true
	defer func() {
		if cleanup {
			_ = os.Remove(tmpName)
		}
	}()

	if err := tmp.Chmod(mode); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpName, path); err != nil {
		return err
	}
	cleanup = false

	// Best-effort directory sync. Some platforms reject sync on a directory.
	if dirFile, err := os.Open(dir); err == nil {
		_ = dirFile.Sync()
		_ = dirFile.Close()
	}
	return nil
}

func ReadConfigFile() (AppConfig, error) {
	filePath, err := configFilePath()
	if err != nil {
		return AppConfig{}, err
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return AppConfig{}, err
	}

	// A file that exists but holds nothing is a partially written config;
	// fall back to defaults rather than handing back a zeroed AppConfig.
	if len(data) == 0 {
		return DefaultConfig(), nil
	}

	var config AppConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return AppConfig{}, err
	}

	return config, nil
}

// defaultConfig returns the default configuration for the application.
func DefaultConfig() AppConfig {
	return AppConfig{
		BackendURL: backendURL,
		AuthConfig: AuthConfig{
			AccessToken:  "",
			RefreshToken: "",
			ExpiresAt:    0,
		},
		OTELConfig: OTELConfig{
			Endpoint:     constants.OTELEndpoint,
			ServiceName:  constants.OTELService,
			OtelDisabled: constants.OTELDisabled,
		},
	}
}

// overrideConfigWithEnv overrides the configuration with environment variables.
func overrideConfigWithEnv(cfg AppConfig) AppConfig {
	if cfg.BackendURL == "" {
		cfg.BackendURL = backendURL
	}
	if envBackendURL := os.Getenv(constants.EnvBackendURL); envBackendURL != "" {
		cfg.BackendURL = envBackendURL
	} else if envBackendURL := os.Getenv("ENVSYNC_API_URL"); envBackendURL != "" {
		cfg.BackendURL = envBackendURL
	}
	if envTelemetryURL := os.Getenv(constants.EnvOTELURL); envTelemetryURL != "" {
		cfg.OTELConfig.Endpoint = envTelemetryURL
	}
	if envOTELService := os.Getenv(constants.EnvOTELService); envOTELService != "" {
		cfg.OTELConfig.ServiceName = envOTELService
	}
	if envOTELDisabled := os.Getenv(constants.EnvOTELDisabled); envOTELDisabled != "" {
		cfg.OTELConfig.OtelDisabled = envOTELDisabled == "true"
	}

	return cfg
}

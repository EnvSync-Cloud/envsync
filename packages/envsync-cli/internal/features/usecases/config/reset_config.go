package config

import (
	"context"
	"fmt"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/config"
)

type resetConfigUseCase struct{}

func NewResetConfigUseCase() ResetConfigUseCase {
	return &resetConfigUseCase{}
}

func (uc *resetConfigUseCase) Execute(ctx context.Context, req ResetConfigRequest) error {
	// Validate request
	if err := req.Validate(); err != nil {
		return NewValidationError("invalid reset config request", "", err)
	}

	// Read current configuration
	cfg, err := config.ReadConfigFile()
	if err != nil {
		return NewFileSystemError("failed to read config file", err)
	}

	// Reset configuration based on request
	if len(req.Keys) == 0 {
		// Reset all configuration
		err = uc.resetAllConfig()
	} else {
		// Reset specific keys
		err = uc.resetSpecificKeys(cfg, req.Keys)
	}

	if err != nil {
		return err
	}

	return nil
}

func (uc *resetConfigUseCase) resetAllConfig() error {
	emptyCfg := config.AppConfig{
		BackendURL:   "https://api.envsync.cloud",
		TelemetryURL: "https://obs.envsync.cloud",
	}

	if err := emptyCfg.WriteConfigFile(); err != nil {
		return NewFileSystemError("failed to write reset config file", err)
	}

	return nil
}

func (uc *resetConfigUseCase) resetSpecificKeys(cfg config.AppConfig, keys []string) error {
	for _, key := range keys {
		if err := uc.resetConfigKey(&cfg, key); err != nil {
			return NewValidationError("failed to reset config key", key, err)
		}
	}

	if err := cfg.WriteConfigFile(); err != nil {
		return NewFileSystemError("failed to write updated config file", err)
	}

	return nil
}

func (uc *resetConfigUseCase) resetConfigKey(cfg *config.AppConfig, key string) error {
	normalizedKey := strings.ToLower(key)

	switch normalizedKey {
	case "backend_url", "backendurl":
		cfg.BackendURL = "https://api.envsync.cloud"
	case "telemetry_url", "telemetryurl":
		cfg.TelemetryURL = "https://obs.envsync.cloud"
	case "access_token", "accesstoken":
		cfg.AccessToken = ""
	case "telemetry_token", "telemetrytoken":
		cfg.TelemetryToken = ""
	default:
		return fmt.Errorf("unknown configuration key: '%s'. Valid keys are: backend_url, telemetry_url, access_token, telemetry_token", key)
	}

	return nil
}

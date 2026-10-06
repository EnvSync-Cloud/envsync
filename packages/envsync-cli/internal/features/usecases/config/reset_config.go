package config

import (
	"context"
	"fmt"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/config"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/constants"
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
		err = uc.resetAllConfig()
	} else {
		err = uc.resetSpecificKeys(cfg, req.Keys)
	}
	if err != nil {
		return err
	}

	return nil
}

func (uc *resetConfigUseCase) resetAllConfig() error {
	cfg := config.DefaultConfig()

	if err := cfg.WriteConfigFile(); err != nil {
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
		cfg.OTELConfig.Endpoint = constants.OTELEndpoint
	case "service_name", "servicename":
		cfg.OTELConfig.ServiceName = ""
	case "access_token", "accesstoken":
		cfg.AuthConfig.AccessToken = ""
	case "refresh_token", "refreshtoken":
		cfg.AuthConfig.RefreshToken = ""
	case "expires_at", "expiresat":
		cfg.AuthConfig.ExpiresAt = 0
	case "client_id", "clientid":
		cfg.AuthConfig.ClientID = ""
	case "token_url", "tokenurl":
		cfg.AuthConfig.TokenURL = ""
	default:
		return fmt.Errorf("unknown configuration key: '%s'. Valid keys are: backend_url, telemetry_url, access_token, refresh_token, expires_at, client_id, token_url", key)
	}

	return nil
}

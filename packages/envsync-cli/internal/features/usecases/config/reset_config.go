package config

import (
	"context"
	"fmt"
	"strings"

	"github.com/EnvSync-Cloud/envsync-cli/internal/config"
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
	// Create empty configuration
	emptyCfg := config.AppConfig{}

	// Write empty configuration to file
	if err := emptyCfg.WriteConfigFile(); err != nil {
		return NewFileSystemError("failed to write reset config file", err)
	}

	return nil
}

func (uc *resetConfigUseCase) resetSpecificKeys(cfg config.AppConfig, keys []string) error {
	// Reset specific configuration keys
	for _, key := range keys {
		if err := uc.resetConfigKey(&cfg, key); err != nil {
			return NewValidationError("failed to reset config key", key, err)
		}
	}

	// Write updated configuration to file
	if err := cfg.WriteConfigFile(); err != nil {
		return NewFileSystemError("failed to write updated config file", err)
	}

	return nil
}

func (uc *resetConfigUseCase) resetConfigKey(cfg *config.AppConfig, key string) error {
	// Normalize key to lowercase for comparison
	normalizedKey := strings.ToLower(key)

	switch normalizedKey {
	case "backend_url", "backendurl":
		cfg.BackendURL = "https://api.envsync.dev/api"
	default:
		return fmt.Errorf("unknown configuration key: '%s'. Valid keys are: backend_url", key)
	}

	return nil
}

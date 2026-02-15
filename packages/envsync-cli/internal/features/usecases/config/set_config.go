package config

import (
	"context"
	"fmt"
	"strings"

	"github.com/EnvSync-Cloud/envsync-cli/internal/config"
)

type setConfigUseCase struct{}

func NewSetConfigUseCase() SetConfigUseCase {
	return &setConfigUseCase{}
}

func (uc *setConfigUseCase) Execute(ctx context.Context, req SetConfigRequest) error {
	// Validate request
	if err := req.Validate(); err != nil {
		return NewValidationError("invalid set config request", "", err)
	}

	// Read current config from file (create new if doesn't exist)
	cfg, err := config.ReadConfigFile()
	if err != nil {
		// If config file doesn't exist, create a new one
		cfg = config.AppConfig{}
	}

	// Apply the configuration changes
	for key, value := range req.KeyValuePairs {
		if err := uc.setConfigValue(&cfg, key, value); err != nil {
			return NewValidationError("failed to set config value", key, err)
		}
	}

	// Validate the final configuration
	if err := uc.validateConfiguration(cfg); err != nil {
		return NewValidationError("configuration validation failed", "", err)
	}

	// Write the updated configuration to file
	if err := cfg.WriteConfigFile(); err != nil {
		return NewFileSystemError("failed to write config file", err)
	}

	return nil
}

func (uc *setConfigUseCase) setConfigValue(cfg *config.AppConfig, key, value string) error {
	// Normalize key to lowercase for comparison
	normalizedKey := strings.ToLower(key)

	switch normalizedKey {
	case "backend_url", "backendurl":
		cfg.BackendURL = value
	default:
		return fmt.Errorf("unknown configuration key: '%s'. Valid keys are: backend_url", key)
	}

	return nil
}

func (uc *setConfigUseCase) validateConfiguration(cfg config.AppConfig) error {
	var issues []string

	// Validate backend URL
	if cfg.BackendURL != "" {
		if !uc.isValidURL(cfg.BackendURL) {
			issues = append(issues, "backend URL format is invalid")
		}
		if strings.HasPrefix(cfg.BackendURL, "http://") && !uc.isLocalAddress(cfg.BackendURL) {
			issues = append(issues, "backend URL uses insecure HTTP protocol (consider using HTTPS)")
		}
	}

	if len(issues) > 0 {
		return fmt.Errorf("configuration validation failed: %s", strings.Join(issues, "; "))
	}

	return nil
}

func (uc *setConfigUseCase) isValidURL(url string) bool {
	// Basic URL validation
	url = strings.TrimSpace(url)
	if len(url) == 0 {
		return false
	}

	// Check for basic URL structure
	hasProtocol := strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://")
	if !hasProtocol {
		return false
	}

	// Check for domain part after protocol
	if strings.HasPrefix(url, "http://") {
		domain := url[7:] // Remove "http://"
		return len(domain) > 0 && !strings.Contains(domain[:1], "/")
	}

	if strings.HasPrefix(url, "https://") {
		domain := url[8:] // Remove "https://"
		return len(domain) > 0 && !strings.Contains(domain[:1], "/")
	}

	return false
}

func (uc *setConfigUseCase) isLocalAddress(url string) bool {
	// Allow HTTP for localhost and local addresses
	localPatterns := []string{
		"http://localhost",
		"http://127.0.0.1",
		"http://0.0.0.0",
		"http://::1",
	}

	for _, pattern := range localPatterns {
		if strings.HasPrefix(url, pattern) {
			return true
		}
	}

	return false
}

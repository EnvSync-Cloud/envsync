package config

import (
	"context"
	"strings"

	"github.com/EnvSync-Cloud/envsync-cli/internal/config"
)

type getConfigUseCase struct{}

func NewGetConfigUseCase() GetConfigUseCase {
	return &getConfigUseCase{}
}

func (uc *getConfigUseCase) Execute(ctx context.Context, req GetConfigRequest) (*GetConfigResponse, error) {
	// Validate request
	if err := req.Validate(); err != nil {
		return nil, NewValidationError("invalid get config request", "", err)
	}

	// Read current configuration from file
	cfg, err := config.ReadConfigFile()
	if err != nil {
		return nil, NewFileSystemError("failed to read config file", err)
	}

	// Prepare response
	response := &GetConfigResponse{
		Config:   cfg,
		Values:   make(map[string]string),
		IsEmpty:  uc.isConfigEmpty(cfg),
		Warnings: []string{},
	}

	// If specific keys were requested, extract only those values
	if len(req.Keys) > 0 {
		for _, key := range req.Keys {
			value, exists := uc.getConfigValue(cfg, key)
			if exists {
				response.Values[key] = value
			} else {
				response.Warnings = append(response.Warnings, "Key '"+key+"' not found in configuration")
			}
		}
	} else {
		// Return all configuration values
		response.Values = uc.getAllConfigValues(cfg)
	}

	// Add configuration warnings
	warnings := uc.generateConfigWarnings(cfg)
	response.Warnings = append(response.Warnings, warnings...)

	return response, nil
}

func (uc *getConfigUseCase) getConfigValue(cfg config.AppConfig, key string) (string, bool) {
	// Normalize key to lowercase for comparison
	normalizedKey := strings.ToLower(key)

	switch normalizedKey {
	case "backend_url", "backendurl":
		return cfg.BackendURL, cfg.BackendURL != ""
	default:
		return "", false
	}
}

func (uc *getConfigUseCase) getAllConfigValues(cfg config.AppConfig) map[string]string {
	values := make(map[string]string)

	if cfg.BackendURL != "" {
		values["backend_url"] = cfg.BackendURL
	}

	return values
}

func (uc *getConfigUseCase) isConfigEmpty(cfg config.AppConfig) bool {
	return cfg.BackendURL == ""
}

func (uc *getConfigUseCase) generateConfigWarnings(cfg config.AppConfig) []string {
	var warnings []string

	// Check for missing required configuration
	if cfg.BackendURL == "" {
		warnings = append(warnings, "Backend URL is not set. Use 'envsync config set backend_url=<url>' to set it.")
	}

	// Check for insecure configurations
	if cfg.BackendURL != "" && strings.HasPrefix(cfg.BackendURL, "http://") {
		warnings = append(warnings, "Backend URL uses insecure HTTP protocol. Consider using HTTPS for better security.")
	}

	return warnings
}

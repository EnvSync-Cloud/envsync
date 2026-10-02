package config

import (
	"context"
	"strconv"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/config"
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

	// If specific keys were requested, extract only those values. A key that is
	// known resolves even when its value is empty, so callers can tell "unset"
	// (present, "") apart from "unknown" (absent).
	if len(req.Keys) > 0 {
		for _, key := range req.Keys {
			if value, known := uc.getConfigValue(cfg, key); known {
				response.Values[key] = value
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

// getConfigValue resolves a key against the configuration. The second result
// reports whether the key is known at all — it must not depend on the value,
// or a false boolean or an unset string is indistinguishable from a typo.
func (uc *getConfigUseCase) getConfigValue(cfg config.AppConfig, key string) (string, bool) {
	switch key {
	case "backend_url":
		return cfg.BackendURL, true
	case "otel_config.endpoint":
		return cfg.OTELConfig.Endpoint, true
	case "otel_config.service_name":
		return cfg.OTELConfig.ServiceName, true
	case "otel_config.disabled":
		return strconv.FormatBool(cfg.OTELConfig.OtelDisabled), true
	default:
		return "", false
	}
}

func (uc *getConfigUseCase) getAllConfigValues(cfg config.AppConfig) map[string]string {
	values := make(map[string]string)

	values["backend_url"] = cfg.BackendURL
	values["otel_config.endpoint"] = cfg.OTELConfig.Endpoint
	values["otel_config.service_name"] = cfg.OTELConfig.ServiceName
	values["otel_config.disabled"] = strconv.FormatBool(cfg.OTELConfig.OtelDisabled)

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

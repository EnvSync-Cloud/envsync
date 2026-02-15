package config

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/config"
)

// SetConfigUseCase defines the interface for setting configuration values
type SetConfigUseCase interface {
	Execute(context.Context, SetConfigRequest) error
}

// GetConfigUseCase defines the irface for getting configuration values
type GetConfigUseCase interface {
	Execute(context.Context, GetConfigRequest) (*GetConfigResponse, error)
}

// ResetConfseCase defines the inface for resetting configuration
type ResetConfigUseCase interface {
	Execute(context.Context, ResetConfigRequest) error
}

// Request/Response types

type SetConfigRequest struct {
	KeyValuePairs map[string]string
}

type GetConfigRequest struct {
	Keys []string // If empty, get all config values
}

type GetConfigResponse struct {
	Config   config.AppConfig
	Values   map[string]string // Specific requested values
	IsEmpty  bool
	Warnings []string
}

type ValidateConfigRequest struct {
	Config *config.AppConfig // If nil, validate current config file
}

type ValidationIssue struct {
	Key        string
	Message    string
	Severity   string // "error", "warning", "info"
	Suggestion string
}

type ResetConfigRequest struct {
	Keys []string // If empty, reset all config
}

// Validation interface for requests
type Validator interface {
	Validate() error
}

// Implement validation for each request type
func (r SetConfigRequest) Validate() error {
	if len(r.KeyValuePairs) == 0 {
		return ErrNoConfigValues
	}

	for key, value := range r.KeyValuePairs {
		if key == "" {
			return ErrEmptyConfigKey
		}
		if !isValidConfigKey(key) {
			return ErrInvalidConfigKey
		}
		if err := validateConfigValue(key, value); err != nil {
			return err
		}
	}

	return nil
}

func (r GetConfigRequest) Validate() error {
	for _, key := range r.Keys {
		if key == "" {
			return ErrEmptyConfigKey
		}
		if !isValidConfigKey(key) {
			return ErrInvalidConfigKey
		}
	}
	return nil
}

func (r ValidateConfigRequest) Validate() error {
	// No specific validation needed for validation request
	return nil
}

func (r ResetConfigRequest) Validate() error {
	for _, key := range r.Keys {
		if key == "" {
			return ErrEmptyConfigKey
		}
		if !isValidConfigKey(key) {
			return ErrInvalidConfigKey
		}
	}
	return nil
}

// Helper functions for validation
func isValidConfigKey(key string) bool {
	validKeys := map[string]bool{
		"backend_url": true,
		"backendurl":  true,
	}

	return validKeys[key]
}

func validateConfigValue(key, value string) error {
	switch key {
	case "backend_url", "backendurl":
		if value == "" {
			return ErrEmptyBackendURL
		}
		if !isValidURL(value) {
			return ErrInvalidBackendURL
		}
	}

	return nil
}

func isValidURL(url string) bool {
	// Simple URL validation - in real implementation, use proper URL parsing
	return len(url) > 0 && (len(url) >= 7 && url[:7] == "http://" ||
		len(url) >= 8 && url[:8] == "https://")
}

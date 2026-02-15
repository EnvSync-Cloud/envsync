package config

import "errors"

// Configuration use case errors
var (
	// Validation errors
	ErrNoConfigValues   = errors.New("no configuration values provided")
	ErrEmptyConfigKey   = errors.New("configuration key cannot be empty")
	ErrInvalidConfigKey = errors.New("invalid configuration key")

	ErrEmptyBackendURL   = errors.New("backend URL cannot be empty")
	ErrInvalidBackendURL = errors.New("backend URL is invalid")

	// File system errors
	ErrConfigFileNotFound   = errors.New("configuration file not found")
	ErrConfigFileRead       = errors.New("failed to read configuration file")
	ErrConfigFileWrite      = errors.New("failed to write configuration file")
	ErrConfigFilePermission = errors.New("insufficient permissions to access configuration file")
	ErrConfigFileCorrupted  = errors.New("configuration file is corrupted or invalid")

	// Business logic errors
	ErrConfigNotInitialized = errors.New("configuration is not initialized")
	ErrConfigAlreadyExists  = errors.New("configuration already exists")
	ErrConfigLocked         = errors.New("configuration is locked and cannot be modified")
	ErrConfigBackupFailed   = errors.New("failed to create configuration backup")

	// External service errors
	ErrConfigServiceUnavailable = errors.New("configuration service is currently unavailable")
	ErrConfigValidationFailed   = errors.New("configuration validation failed")
	ErrConfigSyncFailed         = errors.New("failed to sync configuration")
)

// Error types for structured error handling
type ConfigError struct {
	Code    string
	Message string
	Key     string
	Cause   error
}

func (e ConfigError) Error() string {
	if e.Key != "" {
		if e.Cause != nil {
			return e.Message + " for key '" + e.Key + "': " + e.Cause.Error()
		}
		return e.Message + " for key '" + e.Key + "'"
	}

	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e ConfigError) Unwrap() error {
	return e.Cause
}

// Error codes
const (
	ConfigErrorCodeValidation   = "VALIDATION_ERROR"
	ConfigErrorCodeFileSystem   = "FILE_SYSTEM_ERROR"
	ConfigErrorCodePermission   = "PERMISSION_ERROR"
	ConfigErrorCodeNotFound     = "CONFIG_NOT_FOUND"
	ConfigErrorCodeCorrupted    = "CONFIG_CORRUPTED"
	ConfigErrorCodeServiceError = "SERVICE_ERROR"
)

// Helper functions to create structured errors
func NewValidationError(message, key string, cause error) *ConfigError {
	return &ConfigError{
		Code:    ConfigErrorCodeValidation,
		Message: message,
		Key:     key,
		Cause:   cause,
	}
}

func NewFileSystemError(message string, cause error) *ConfigError {
	return &ConfigError{
		Code:    ConfigErrorCodeFileSystem,
		Message: message,
		Cause:   cause,
	}
}

func NewPermissionError(message string, cause error) *ConfigError {
	return &ConfigError{
		Code:    ConfigErrorCodePermission,
		Message: message,
		Cause:   cause,
	}
}

func NewNotFoundError(message string, cause error) *ConfigError {
	return &ConfigError{
		Code:    ConfigErrorCodeNotFound,
		Message: message,
		Cause:   cause,
	}
}

func NewCorruptedError(message string, cause error) *ConfigError {
	return &ConfigError{
		Code:    ConfigErrorCodeCorrupted,
		Message: message,
		Cause:   cause,
	}
}

func NewServiceError(message string, cause error) *ConfigError {
	return &ConfigError{
		Code:    ConfigErrorCodeServiceError,
		Message: message,
		Cause:   cause,
	}
}

// Validation severity levels
const (
	ValidationSeverityError   = "error"
	ValidationSeverityWarning = "warning"
	ValidationSeverityInfo    = "info"
)

// Common validation messages
const (
	MsgBackendURLRequired = "Backend URL is required to connect to the service"
	MsgBackendURLInsecure = "Backend URL uses insecure HTTP protocol"
	MsgConfigIncomplete   = "Configuration is incomplete"
	MsgConfigOutdated     = "Configuration format appears to be outdated"
)

// Suggestion messages
const (
	SuggestSetBackendURL  = "Use 'envsync config set backend_url=<url>' to set the backend URL"
	SuggestUseHTTPS       = "Consider using HTTPS for better security"
	SuggestRunLogin       = "Run 'envsync login' to authenticate and set up configuration"
	SuggestValidateConfig = "Run 'envsync config validate' to check your configuration"
)

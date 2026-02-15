package environment

import "errors"

// Environment use case errors
var (
	// Validation errors
	ErrNoEnvValues     = errors.New("no environment values provided")
	ErrEmptyEnvKey     = errors.New("environment key cannot be empty")
	ErrInvalidEnvKey   = errors.New("invalid environment key")
	ErrEmptyEnvName    = errors.New("environment name cannot be empty")
	ErrInvalidEnvName  = errors.New("invalid environment name")
	ErrEmptyEnvValue   = errors.New("environment value cannot be empty")
	ErrInvalidEnvValue = errors.New("invalid environment value")

	// File system errors
	ErrEnvFileNotFound   = errors.New("environment file not found")
	ErrEnvFileRead       = errors.New("failed to read environment file")
	ErrEnvFileWrite      = errors.New("failed to write environment file")
	ErrEnvFilePermission = errors.New("insufficient permissions to access environment file")
	ErrEnvFileCorrupted  = errors.New("environment file is corrupted or invalid")

	// Business logic errors
	ErrEnvNotInitialized = errors.New("environment is not initialized")
	ErrEnvAlreadyExists  = errors.New("environment already exists")
	ErrEnvLocked         = errors.New("environment is locked and cannot be modified")
	ErrEnvBackupFailed   = errors.New("failed to create environment backup")

	// External service errors
	ErrEnvServiceUnavailable = errors.New("environment service is currently unavailable")
	ErrEnvValidationFailed   = errors.New("environment validation failed")
	ErrEnvSyncFailed         = errors.New("failed to sync environment")
)

// Error types for structured error handling
type EnvError struct {
	Code    string
	Message string
	Key     string
	Cause   error
}

func (e EnvError) Error() string {
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

func (e EnvError) Unwrap() error {
	return e.Cause
}

// Error codes
const (
	EnvErrorCodeValidation   = "VALIDATION_ERROR"
	EnvErrorCodeFileSystem   = "FILE_SYSTEM_ERROR"
	EnvErrorCodePermission   = "PERMISSION_ERROR"
	EnvErrorCodeNotFound     = "ENV_NOT_FOUND"
	EnvErrorCodeCorrupted    = "ENV_CORRUPTED"
	EnvErrorCodeServiceError = "SERVICE_ERROR"
)

// Helper functions to create structured errors
func NewValidationError(message, key string, cause error) *EnvError {
	return &EnvError{
		Code:    EnvErrorCodeValidation,
		Message: message,
		Key:     key,
		Cause:   cause,
	}
}

func NewFileSystemError(message string, cause error) *EnvError {
	return &EnvError{
		Code:    EnvErrorCodeFileSystem,
		Message: message,
		Cause:   cause,
	}
}

func NewPermissionError(message string, cause error) *EnvError {
	return &EnvError{
		Code:    EnvErrorCodePermission,
		Message: message,
		Cause:   cause,
	}
}

func NewNotFoundError(message string, cause error) *EnvError {
	return &EnvError{
		Code:    EnvErrorCodeNotFound,
		Message: message,
		Cause:   cause,
	}
}

func NewCorruptedError(message string, cause error) *EnvError {
	return &EnvError{
		Code:    EnvErrorCodeCorrupted,
		Message: message,
		Cause:   cause,
	}
}

func NewServiceError(message string, cause error) *EnvError {
	return &EnvError{
		Code:    EnvErrorCodeServiceError,
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
	MsgEnvNameRequired  = "Environment name is required"
	MsgEnvKeyRequired   = "Environment key is required"
	MsgEnvValueRequired = "Environment value is required"
	MsgEnvKeyInvalid    = "Environment key format is invalid"
	MsgEnvIncomplete    = "Environment configuration is incomplete"
	MsgEnvOutdated      = "Environment configuration format appears to be outdated"
)

// Suggestion messages
const (
	SuggestSetEnvName  = "Use 'envsync env set name=<environment-name>' to set the environment name"
	SuggestSetEnvKey   = "Use 'envsync env set key=<key> value=<value>' to set an environment variable"
	SuggestValidateEnv = "Run 'envsync env validate' to check your environment configuration"
	SuggestSyncEnv     = "Run 'envsync env sync' to synchronize your environment variables"
)

package init

import "errors"

// Init use case errors
var (
	// Validation errors
	ErrNoConfigPath        = errors.New("configuration path not provided")
	ErrEmptyConfigPath     = errors.New("configuration path cannot be empty")
	ErrInvalidConfigPath   = errors.New("invalid configuration path")
	ErrAppIDRequired       = errors.New("application ID is required")
	ErrEnvTypeIDRequired   = errors.New("environment type ID is required")
	ErrInvalidAppSelection = errors.New("invalid application selection")
	ErrInvalidEnvSelection = errors.New("invalid environment type selection")

	// File system errors
	ErrConfigFileExists     = errors.New("configuration file already exists")
	ErrConfigFileCreate     = errors.New("failed to create configuration file")
	ErrConfigFileWrite      = errors.New("failed to write configuration file")
	ErrConfigFilePermission = errors.New("insufficient permissions to create configuration file")
	ErrConfigDirCreate      = errors.New("failed to create configuration directory")
	ErrConfigDirPermission  = errors.New("insufficient permissions to access configuration directory")

	// Business logic errors
	ErrInitAlreadyCompleted = errors.New("initialization has already been completed")
	ErrNoApplicationsFound  = errors.New("no applications available for initialization")
	ErrNoEnvironmentsFound  = errors.New("no environment types available for selected application")
	ErrInitCancelled        = errors.New("initialization was cancelled by user")
	ErrInvalidWorkingDir    = errors.New("invalid working directory for initialization")

	// External service errors
	ErrAppServiceUnavailable = errors.New("application service is currently unavailable")
	ErrEnvServiceUnavailable = errors.New("environment service is currently unavailable")
	ErrServiceTimeout        = errors.New("service request timed out during initialization")
	ErrNetworkError          = errors.New("network error during initialization")

	// TUI errors
	ErrTUIInitFailed    = errors.New("failed to initialize TUI")
	ErrTUIFormError     = errors.New("error in TUI form interaction")
	ErrTUIUserCancelled = errors.New("user cancelled the initialization process")
	ErrTUIInvalidInput  = errors.New("invalid input provided in TUI")

	// Configuration errors
	ErrConfigValidation    = errors.New("configuration validation failed")
	ErrConfigSerialization = errors.New("failed to serialize configuration")
	ErrConfigBackupFailed  = errors.New("failed to create configuration backup")
	ErrConfigCorrupt       = errors.New("existing configuration file is corrupted")
)

// Error types for structured error handling
type InitError struct {
	Code    string
	Message string
	Path    string
	Cause   error
}

func (e InitError) Error() string {
	if e.Path != "" {
		if e.Cause != nil {
			return e.Message + " at path '" + e.Path + "': " + e.Cause.Error()
		}
		return e.Message + " at path '" + e.Path + "'"
	}

	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e InitError) Unwrap() error {
	return e.Cause
}

// Error codes
const (
	InitErrorCodeValidation    = "VALIDATION_ERROR"
	InitErrorCodeFileSystem    = "FILE_SYSTEM_ERROR"
	InitErrorCodePermission    = "PERMISSION_ERROR"
	InitErrorCodeAlreadyExists = "ALREADY_EXISTS"
	InitErrorCodeNotFound      = "NOT_FOUND"
	InitErrorCodeServiceError  = "SERVICE_ERROR"
	InitErrorCodeNetworkError  = "NETWORK_ERROR"
	InitErrorCodeTUIError      = "TUI_ERROR"
	InitErrorCodeCancelled     = "CANCELLED"
	InitErrorCodeTimeout       = "TIMEOUT"
)

// Helper functions to create structured errors
func NewValidationError(message, path string, cause error) *InitError {
	return &InitError{
		Code:    InitErrorCodeValidation,
		Message: message,
		Path:    path,
		Cause:   cause,
	}
}

func NewFileSystemError(message, path string, cause error) *InitError {
	return &InitError{
		Code:    InitErrorCodeFileSystem,
		Message: message,
		Path:    path,
		Cause:   cause,
	}
}

func NewPermissionError(message, path string, cause error) *InitError {
	return &InitError{
		Code:    InitErrorCodePermission,
		Message: message,
		Path:    path,
		Cause:   cause,
	}
}

func NewAlreadyExistsError(message, path string, cause error) *InitError {
	return &InitError{
		Code:    InitErrorCodeAlreadyExists,
		Message: message,
		Path:    path,
		Cause:   cause,
	}
}

func NewNotFoundError(message string, cause error) *InitError {
	return &InitError{
		Code:    InitErrorCodeNotFound,
		Message: message,
		Cause:   cause,
	}
}

func NewServiceError(message string, cause error) *InitError {
	return &InitError{
		Code:    InitErrorCodeServiceError,
		Message: message,
		Cause:   cause,
	}
}

func NewNetworkError(message string, cause error) *InitError {
	return &InitError{
		Code:    InitErrorCodeNetworkError,
		Message: message,
		Cause:   cause,
	}
}

func NewTUIError(message string, cause error) *InitError {
	return &InitError{
		Code:    InitErrorCodeTUIError,
		Message: message,
		Cause:   cause,
	}
}

func NewCancelledError(message string, cause error) *InitError {
	return &InitError{
		Code:    InitErrorCodeCancelled,
		Message: message,
		Cause:   cause,
	}
}

func NewTimeoutError(message string, cause error) *InitError {
	return &InitError{
		Code:    InitErrorCodeTimeout,
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
	MsgConfigPathRequired   = "Configuration file path is required for initialization"
	MsgAppSelectionRequired = "Application selection is required"
	MsgEnvSelectionRequired = "Environment type selection is required"
	MsgWorkingDirInvalid    = "Current working directory is not suitable for initialization"
	MsgConfigAlreadyExists  = "Configuration file already exists in this directory"
	MsgNoAppsAvailable      = "No applications are available for initialization"
	MsgNoEnvsAvailable      = "No environment types are available for the selected application"
)

// Suggestion messages
const (
	SuggestUseForceFlag      = "Use '--force' flag to overwrite existing configuration"
	SuggestCreateApp         = "Create a new application using 'envsync app create' first"
	SuggestCreateEnv         = "Create environment types for your application first"
	SuggestCheckPermissions  = "Check file permissions in the current directory"
	SuggestCheckNetworkConn  = "Check your network connection and try again"
	SuggestRunInitInEmptyDir = "Run 'envsync init' in an empty directory or project root"
	SuggestLoginFirst        = "Run 'envsync login' to authenticate before initialization"
)

package log_forwarding

import "errors"

// Log forwarding use case errors
var (
	// Validation errors
	ErrConfigIDRequired      = errors.New("log forwarding config ID is required")
	ErrTargetRequired        = errors.New("log forwarding target (provider type) is required")
	ErrEndpointURLRequired   = errors.New("endpoint URL is required")
	ErrAPIKeyRequired        = errors.New("API key is required")
	ErrInvalidTarget         = errors.New("invalid target. Must be one of: datadog, splunk, sumo-logic")
	ErrConfigNameRequired    = errors.New("log forwarding config name is required")

	// Business logic errors
	ErrConfigNotFound      = errors.New("log forwarding config not found")
	ErrConfigAlreadyExists = errors.New("log forwarding config already exists")

	// External service errors
	ErrServiceUnavailable = errors.New("log forwarding service is currently unavailable")
	ErrCreateFailed       = errors.New("failed to create log forwarding config")
	ErrDeleteFailed       = errors.New("failed to delete log forwarding config")
	ErrListFailed         = errors.New("failed to list log forwarding configs")
	ErrGetFailed          = errors.New("failed to get log forwarding config")
)

// Error types for structured error handling
type LogForwardingError struct {
	Code    string
	Message string
	Cause   error
}

func (e LogForwardingError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e LogForwardingError) Unwrap() error {
	return e.Cause
}

// Error codes
const (
	ErrorCodeValidation    = "VALIDATION_ERROR"
	ErrorCodeNotFound      = "CONFIG_NOT_FOUND"
	ErrorCodeAlreadyExists = "CONFIG_ALREADY_EXISTS"
	ErrorCodeAccessDenied  = "ACCESS_DENIED"
	ErrorCodeServiceError  = "SERVICE_ERROR"
)

// Helper functions to create structured errors
func NewValidationError(message string, cause error) *LogForwardingError {
	return &LogForwardingError{
		Code:    ErrorCodeValidation,
		Message: message,
		Cause:   cause,
	}
}

func NewNotFoundError(message string, cause error) *LogForwardingError {
	return &LogForwardingError{
		Code:    ErrorCodeNotFound,
		Message: message,
		Cause:   cause,
	}
}

func NewServiceError(message string, cause error) *LogForwardingError {
	return &LogForwardingError{
		Code:    ErrorCodeServiceError,
		Message: message,
		Cause:   cause,
	}
}

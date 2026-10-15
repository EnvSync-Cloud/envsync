package service_token

import "errors"

var (
	ErrTokenNameRequired = errors.New("service token name is required")
	ErrTokenIDRequired   = errors.New("service token ID is required")
	ErrTokenNotFound     = errors.New("service token not found")

	// ErrTokenCreateCancelled means the user backed out of the create wizard.
	ErrTokenCreateCancelled = errors.New("service token creation cancelled by user")
	// ErrTokenSelectionCancelled means the user backed out of the get picker.
	ErrTokenSelectionCancelled = errors.New("service token selection cancelled by user")
	// ErrNoApplications / ErrNoEnvironments / ErrNoTokens mean a picker has
	// nothing to show.
	ErrNoApplications = errors.New("no applications available")
	ErrNoEnvironments = errors.New("no environments available for this application")
	ErrNoTokens       = errors.New("no service tokens available")
)

type ServiceTokenError struct {
	Code    string
	Message string
	Cause   error
}

func (e ServiceTokenError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e ServiceTokenError) Unwrap() error {
	return e.Cause
}

const (
	ServiceTokenErrorCodeValidation   = "VALIDATION_ERROR"
	ServiceTokenErrorCodeNotFound     = "TOKEN_NOT_FOUND"
	ServiceTokenErrorCodeAccessDenied = "ACCESS_DENIED"
	ServiceTokenErrorCodeServiceError = "SERVICE_ERROR"
)

func NewServiceTokenValidationError(message string, cause error) *ServiceTokenError {
	return &ServiceTokenError{
		Code:    ServiceTokenErrorCodeValidation,
		Message: message,
		Cause:   cause,
	}
}

func NewServiceTokenNotFoundError(message string, cause error) *ServiceTokenError {
	return &ServiceTokenError{
		Code:    ServiceTokenErrorCodeNotFound,
		Message: message,
		Cause:   cause,
	}
}

func NewServiceTokenServiceError(message string, cause error) *ServiceTokenError {
	return &ServiceTokenError{
		Code:    ServiceTokenErrorCodeServiceError,
		Message: message,
		Cause:   cause,
	}
}

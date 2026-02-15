package app

import "errors"

// Application use case errors
var (
	// Validation errors
	ErrAppNameRequired        = errors.New("application name is required")
	ErrAppDescriptionRequired = errors.New("application description is required")
	ErrAppIdentifierRequired  = errors.New("application ID or name is required")
	ErrAppIDRequired          = errors.New("application ID is required")
	ErrInvalidLimit           = errors.New("limit must be non-negative")
	ErrInvalidOffset          = errors.New("offset must be non-negative")

	// Business logic errors
	ErrAppNotFound           = errors.New("application not found")
	ErrAppAlreadyExists      = errors.New("application already exists")
	ErrAppNameTooLong        = errors.New("application name is too long (max 100 characters)")
	ErrAppDescriptionTooLong = errors.New("application description is too long (max 500 characters)")
	ErrInvalidAppName        = errors.New("application name contains invalid characters")
	ErrAppNameEmpty          = errors.New("application name cannot be empty")

	// Permission errors
	ErrAppAccessDenied = errors.New("access denied to application")
	ErrAppModifyDenied = errors.New("modification denied for application")
	ErrAppDeleteDenied = errors.New("deletion denied for application")

	// Dependency errors
	ErrAppHasEnvironments = errors.New("cannot delete application with existing environments")
	ErrAppInUse           = errors.New("application is currently in use")

	// External service errors
	ErrAppServiceUnavailable = errors.New("application service is currently unavailable")
	ErrAppCreateFailed       = errors.New("failed to create application")
	ErrAppUpdateFailed       = errors.New("failed to update application")
	ErrAppDeleteFailed       = errors.New("failed to delete application")
	ErrAppListFailed         = errors.New("failed to list applications")
	ErrAppGetFailed          = errors.New("failed to get application")
)

// Error types for structured error handling
type AppError struct {
	Code    string
	Message string
	Cause   error
}

func (e AppError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e AppError) Unwrap() error {
	return e.Cause
}

// Error codes
const (
	AppErrorCodeValidation    = "VALIDATION_ERROR"
	AppErrorCodeNotFound      = "APP_NOT_FOUND"
	AppErrorCodeAlreadyExists = "APP_ALREADY_EXISTS"
	AppErrorCodeAccessDenied  = "ACCESS_DENIED"
	AppErrorCodeInUse         = "APP_IN_USE"
	AppErrorCodeServiceError  = "SERVICE_ERROR"
	AppErrorTUI               = "TUI_ERROR"
)

// Helper functions to create structured errors
func NewValidationError(message string, cause error) *AppError {
	return &AppError{
		Code:    AppErrorCodeValidation,
		Message: message,
		Cause:   cause,
	}
}

func NewTUIError(message string, cause error) *AppError {
	return &AppError{
		Code:    AppErrorTUI,
		Message: message,
		Cause:   cause,
	}
}

func NewNotFoundError(message string, cause error) *AppError {
	return &AppError{
		Code:    AppErrorCodeNotFound,
		Message: message,
		Cause:   cause,
	}
}

func NewAlreadyExistsError(message string, cause error) *AppError {
	return &AppError{
		Code:    AppErrorCodeAlreadyExists,
		Message: message,
		Cause:   cause,
	}
}

func NewAccessDeniedError(message string, cause error) *AppError {
	return &AppError{
		Code:    AppErrorCodeAccessDenied,
		Message: message,
		Cause:   cause,
	}
}

func NewInUseError(message string, cause error) *AppError {
	return &AppError{
		Code:    AppErrorCodeInUse,
		Message: message,
		Cause:   cause,
	}
}

func NewServiceError(message string, cause error) *AppError {
	return &AppError{
		Code:    AppErrorCodeServiceError,
		Message: message,
		Cause:   cause,
	}
}

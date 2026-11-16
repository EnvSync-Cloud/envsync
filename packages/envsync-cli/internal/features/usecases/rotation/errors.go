package rotation

import "errors"

var (
	ErrIDRequired = errors.New("rotation policy ID is required")
)

type RotationError struct {
	Code    string
	Message string
	Cause   error
}

func (e *RotationError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e *RotationError) Unwrap() error {
	return e.Cause
}

const (
	RotationErrorCodeValidation   = "VALIDATION_ERROR"
	RotationErrorCodeNotFound     = "NOT_FOUND"
	RotationErrorCodeServiceError = "SERVICE_ERROR"
)

func NewValidationError(message string, cause error) *RotationError {
	return &RotationError{
		Code:    RotationErrorCodeValidation,
		Message: message,
		Cause:   cause,
	}
}

func NewNotFoundError(message string, cause error) *RotationError {
	return &RotationError{
		Code:    RotationErrorCodeNotFound,
		Message: message,
		Cause:   cause,
	}
}

func NewServiceError(message string, cause error) *RotationError {
	return &RotationError{
		Code:    RotationErrorCodeServiceError,
		Message: message,
		Cause:   cause,
	}
}

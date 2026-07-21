package service_token

import "errors"

var (
	ErrTokenNameRequired = errors.New("service token name is required")
	ErrTokenIDRequired   = errors.New("service token ID is required")
	ErrTokenNotFound     = errors.New("service token not found")
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

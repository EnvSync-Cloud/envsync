package dynamic_secret

import "errors"

var (
	ErrIDRequired        = errors.New("engine or lease ID is required")
	ErrEngineIDRequired  = errors.New("engine ID is required")
	ErrNameRequired      = errors.New("engine name is required")
	ErrEngineTypeRequired = errors.New("engine type is required")
	ErrConfigRequired    = errors.New("engine config is required")
	ErrEngineNotFound    = errors.New("dynamic secret engine not found")
	ErrLeaseNotFound     = errors.New("dynamic secret lease not found")
	ErrFailedToList      = errors.New("failed to list dynamic secret engines")
	ErrFailedToCreate    = errors.New("failed to create dynamic secret engine")
	ErrFailedToGet       = errors.New("failed to get dynamic secret engine")
	ErrFailedToUpdate    = errors.New("failed to update dynamic secret engine")
	ErrFailedToDelete    = errors.New("failed to delete dynamic secret engine")
	ErrFailedToListLeases  = errors.New("failed to list dynamic secret leases")
	ErrFailedToCreateLease = errors.New("failed to create dynamic secret lease")
	ErrFailedToGetLease    = errors.New("failed to get dynamic secret lease")
	ErrFailedToRevokeLease = errors.New("failed to revoke dynamic secret lease")
	ErrFailedToCleanup     = errors.New("failed to cleanup expired leases")
)

type DynamicSecretError struct {
	Code    string
	Message string
	Cause   error
}

func (e *DynamicSecretError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e *DynamicSecretError) Unwrap() error {
	return e.Cause
}

const (
	DynamicSecretErrorCodeValidation   = "VALIDATION_ERROR"
	DynamicSecretErrorCodeNotFound     = "NOT_FOUND"
	DynamicSecretErrorCodeServiceError = "SERVICE_ERROR"
)

func NewValidationError(message string, cause error) *DynamicSecretError {
	return &DynamicSecretError{
		Code:    DynamicSecretErrorCodeValidation,
		Message: message,
		Cause:   cause,
	}
}

func NewNotFoundError(message string, cause error) *DynamicSecretError {
	return &DynamicSecretError{
		Code:    DynamicSecretErrorCodeNotFound,
		Message: message,
		Cause:   cause,
	}
}

func NewServiceError(message string, cause error) *DynamicSecretError {
	return &DynamicSecretError{
		Code:    DynamicSecretErrorCodeServiceError,
		Message: message,
		Cause:   cause,
	}
}

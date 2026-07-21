package rotation

import "errors"

var (
	ErrIDRequired         = errors.New("rotation policy ID is required")
	ErrNameRequired       = errors.New("rotation policy name is required")
	ErrEngineRequired     = errors.New("engine type is required")
	ErrSecretIDRequired   = errors.New("secret ID (app_id + env_type_id + variable_key) is required")
	ErrScheduleRequired   = errors.New("schedule cron expression is required")
	ErrInvalidEngineType  = errors.New("invalid engine type")
	ErrPolicyNotFound     = errors.New("rotation policy not found")
	ErrFailedToList       = errors.New("failed to list rotation policies")
	ErrFailedToCreate     = errors.New("failed to create rotation policy")
	ErrFailedToGet        = errors.New("failed to get rotation policy")
	ErrFailedToUpdate     = errors.New("failed to update rotation policy")
	ErrFailedToDelete     = errors.New("failed to delete rotation policy")
	ErrFailedToTrigger    = errors.New("failed to trigger rotation")
	ErrFailedToGetStates  = errors.New("failed to get rotation states")
	ErrFailedToRevoke     = errors.New("failed to revoke expired credentials")
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

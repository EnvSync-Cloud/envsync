package gpg_key

import "errors"

var (
	ErrKeyIDRequired    = errors.New("key ID is required")
	ErrKeyNotFound      = errors.New("GPG key not found")
	ErrFileNotFound     = errors.New("file not found")
	ErrSignFailed       = errors.New("signing operation failed")
	ErrVerifyFailed     = errors.New("verification operation failed")
	ErrNameRequired     = errors.New("name is required")
	ErrEmailRequired    = errors.New("email is required")
	ErrNoInputProvided  = errors.New("no input provided (use --file or pipe via stdin)")
)

type GpgKeyError struct {
	Code    string
	Message string
	Cause   error
}

func (e GpgKeyError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e GpgKeyError) Unwrap() error {
	return e.Cause
}

const (
	GpgKeyErrorCodeValidation   = "VALIDATION_ERROR"
	GpgKeyErrorCodeNotFound     = "GPG_KEY_NOT_FOUND"
	GpgKeyErrorCodeServiceError = "SERVICE_ERROR"
	GpgKeyErrorCodeIOError      = "IO_ERROR"
)

func NewValidationError(message string, cause error) *GpgKeyError {
	return &GpgKeyError{Code: GpgKeyErrorCodeValidation, Message: message, Cause: cause}
}

func NewNotFoundError(message string, cause error) *GpgKeyError {
	return &GpgKeyError{Code: GpgKeyErrorCodeNotFound, Message: message, Cause: cause}
}

func NewServiceError(message string, cause error) *GpgKeyError {
	return &GpgKeyError{Code: GpgKeyErrorCodeServiceError, Message: message, Cause: cause}
}

func NewIOError(message string, cause error) *GpgKeyError {
	return &GpgKeyError{Code: GpgKeyErrorCodeIOError, Message: message, Cause: cause}
}

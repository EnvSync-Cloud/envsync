package certificate

import "errors"

var (
	ErrOrgNameRequired    = errors.New("organization name is required")
	ErrEmailRequired      = errors.New("member email is required")
	ErrRoleRequired       = errors.New("role is required")
	ErrSerialRequired     = errors.New("certificate serial number is required")
	ErrCANotInitialized   = errors.New("organization CA not initialized")
	ErrCertNotFound       = errors.New("certificate not found")
)

type CertError struct {
	Code    string
	Message string
	Cause   error
}

func (e CertError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e CertError) Unwrap() error {
	return e.Cause
}

const (
	CertErrorCodeValidation   = "VALIDATION_ERROR"
	CertErrorCodeNotFound     = "CERT_NOT_FOUND"
	CertErrorCodeServiceError = "SERVICE_ERROR"
	CertErrorCodeIOError      = "IO_ERROR"
)

func NewValidationError(message string, cause error) *CertError {
	return &CertError{Code: CertErrorCodeValidation, Message: message, Cause: cause}
}

func NewNotFoundError(message string, cause error) *CertError {
	return &CertError{Code: CertErrorCodeNotFound, Message: message, Cause: cause}
}

func NewServiceError(message string, cause error) *CertError {
	return &CertError{Code: CertErrorCodeServiceError, Message: message, Cause: cause}
}

func NewIOError(message string, cause error) *CertError {
	return &CertError{Code: CertErrorCodeIOError, Message: message, Cause: cause}
}

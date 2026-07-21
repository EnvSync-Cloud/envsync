package saml

import "errors"

var (
	ErrProviderIDRequired     = errors.New("provider ID is required")
	ErrProviderTypeRequired   = errors.New("provider type is required")
	ErrNameRequired           = errors.New("provider name is required")
	ErrEntityIDRequired       = errors.New("entity ID is required")
	ErrSsoURLRequired         = errors.New("SSO URL is required")
	ErrCertificateRequired    = errors.New("certificate is required")
	ErrProviderNotFound       = errors.New("SAML provider not found")
	ErrInvalidProviderType    = errors.New("invalid provider type")
	ErrProviderCreateFailed   = errors.New("failed to create SAML provider")
	ErrProviderUpdateFailed   = errors.New("failed to update SAML provider")
	ErrProviderDeleteFailed   = errors.New("failed to delete SAML provider")
	ErrProviderListFailed     = errors.New("failed to list SAML providers")
	ErrProviderGetFailed      = errors.New("failed to get SAML provider")
	ErrMetadataFailed         = errors.New("failed to get SAML metadata")
	ErrSsoInitiationFailed    = errors.New("failed to initiate SAML SSO")
)

type SamlError struct {
	Code    string
	Message string
	Cause   error
}

func (e SamlError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e SamlError) Unwrap() error {
	return e.Cause
}

const (
	SamlErrorCodeValidation   = "VALIDATION_ERROR"
	SamlErrorCodeNotFound     = "PROVIDER_NOT_FOUND"
	SamlErrorCodeServiceError = "SERVICE_ERROR"
)

func NewValidationError(message string, cause error) *SamlError {
	return &SamlError{Code: SamlErrorCodeValidation, Message: message, Cause: cause}
}

func NewNotFoundError(message string, cause error) *SamlError {
	return &SamlError{Code: SamlErrorCodeNotFound, Message: message, Cause: cause}
}

func NewServiceError(message string, cause error) *SamlError {
	return &SamlError{Code: SamlErrorCodeServiceError, Message: message, Cause: cause}
}

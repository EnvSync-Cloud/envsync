package oidc

import "errors"

var (
	ErrProviderIDRequired    = errors.New("provider ID is required")
	ErrProviderTypeRequired  = errors.New("provider type is required")
	ErrIssuerURLRequired     = errors.New("issuer URL is required")
	ErrAudienceRequired      = errors.New("audience is required")
	ErrProviderNotFound      = errors.New("OIDC provider not found")
	ErrProviderAlreadyExists = errors.New("OIDC provider already exists")
	ErrInvalidProviderType   = errors.New("invalid provider type (must be github_actions, gitlab_ci, kubernetes, or generic)")
	ErrProviderCreateFailed  = errors.New("failed to create OIDC provider")
	ErrProviderUpdateFailed  = errors.New("failed to update OIDC provider")
	ErrProviderDeleteFailed  = errors.New("failed to delete OIDC provider")
	ErrProviderListFailed    = errors.New("failed to list OIDC providers")
	ErrProviderGetFailed     = errors.New("failed to get OIDC provider")
)

type OidcError struct {
	Code    string
	Message string
	Cause   error
}

func (e OidcError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e OidcError) Unwrap() error {
	return e.Cause
}

const (
	OidcErrorCodeValidation   = "VALIDATION_ERROR"
	OidcErrorCodeNotFound     = "PROVIDER_NOT_FOUND"
	OidcErrorCodeServiceError = "SERVICE_ERROR"
)

func NewValidationError(message string, cause error) *OidcError {
	return &OidcError{Code: OidcErrorCodeValidation, Message: message, Cause: cause}
}

func NewNotFoundError(message string, cause error) *OidcError {
	return &OidcError{Code: OidcErrorCodeNotFound, Message: message, Cause: cause}
}

func NewServiceError(message string, cause error) *OidcError {
	return &OidcError{Code: OidcErrorCodeServiceError, Message: message, Cause: cause}
}

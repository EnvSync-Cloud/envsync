package auth

import "errors"

// Authentication use case errors
var (
	// General auth errors
	ErrNotLoggedIn          = errors.New("user is not logged in")
	ErrAlreadyLoggedIn      = errors.New("user is already logged in")
	ErrAuthenticationFailed = errors.New("authentication failed")
	ErrTokenExpired         = errors.New("access token has expired")
	ErrInvalidToken         = errors.New("access token is invalid")

	// Login flow errors
	ErrLoginInitializationFailed = errors.New("failed to initialize login process")
	ErrLoginTimeout              = errors.New("login process timed out")
	ErrLoginCancelled            = errors.New("login process was cancelled")
	ErrBrowserOpenFailed         = errors.New("failed to open browser for authentication")
	ErrDeviceCodeInvalid         = errors.New("device code is invalid or expired")
	ErrPollingFailed             = errors.New("failed to poll for authentication completion")

	// Token management errors
	ErrTokenSaveFailed     = errors.New("failed to save access token")
	ErrTokenRetrieveFailed = errors.New("failed to retrieve access token")
	ErrTokenDeleteFailed   = errors.New("failed to delete access token")

	// User info errors
	ErrUserInfoUnavailable = errors.New("user information is not available")
	ErrUserInfoInvalid     = errors.New("user information is invalid")

	// Service errors
	ErrAuthServiceUnavailable = errors.New("authentication service is currently unavailable")
	ErrNetworkError           = errors.New("network error during authentication")
	ErrServerError            = errors.New("server error during authentication")
)

// Error types for structured error handling
type AuthError struct {
	Code    string
	Message string
	Cause   error
}

func (e AuthError) Error() string {
	if e.Cause != nil {
		return e.Message + ": " + e.Cause.Error()
	}
	return e.Message
}

func (e AuthError) Unwrap() error {
	return e.Cause
}

// Error codes
const (
	AuthErrorCodeNotLoggedIn  = "NOT_LOGGED_IN"
	AuthErrorCodeLoginFailed  = "LOGIN_FAILED"
	AuthErrorCodeTokenInvalid = "TOKEN_INVALID"
	AuthErrorCodeTokenExpired = "TOKEN_EXPIRED"
	AuthErrorCodeServiceError = "SERVICE_ERROR"
	AuthErrorCodeNetworkError = "NETWORK_ERROR"
	AuthErrorCodeTimeout      = "TIMEOUT"
	AuthErrorCodeCancelled    = "CANCELLED"
	AuthErrorCodeValidation   = "VALIDATION_ERROR"
	AuthErrorCodePermission   = "PERMISSION_ERROR"
)

// Helper functions to create structured errors
func NewNotLoggedInError(message string, cause error) *AuthError {
	return &AuthError{
		Code:    AuthErrorCodeNotLoggedIn,
		Message: message,
		Cause:   cause,
	}
}

func NewLoginFailedError(message string, cause error) *AuthError {
	return &AuthError{
		Code:    AuthErrorCodeLoginFailed,
		Message: message,
		Cause:   cause,
	}
}

func NewTokenInvalidError(message string, cause error) *AuthError {
	return &AuthError{
		Code:    AuthErrorCodeTokenInvalid,
		Message: message,
		Cause:   cause,
	}
}

func NewTokenExpiredError(message string, cause error) *AuthError {
	return &AuthError{
		Code:    AuthErrorCodeTokenExpired,
		Message: message,
		Cause:   cause,
	}
}

func NewServiceError(message string, cause error) *AuthError {
	return &AuthError{
		Code:    AuthErrorCodeServiceError,
		Message: message,
		Cause:   cause,
	}
}

func NewNetworkError(message string, cause error) *AuthError {
	return &AuthError{
		Code:    AuthErrorCodeNetworkError,
		Message: message,
		Cause:   cause,
	}
}

func NewTimeoutError(message string, cause error) *AuthError {
	return &AuthError{
		Code:    AuthErrorCodeTimeout,
		Message: message,
		Cause:   cause,
	}
}

func NewCancelledError(message string, cause error) *AuthError {
	return &AuthError{
		Code:    AuthErrorCodeCancelled,
		Message: message,
		Cause:   cause,
	}
}

func NewValidationError(message string, cause error) *AuthError {
	return &AuthError{
		Code:    AuthErrorCodeValidation,
		Message: message,
		Cause:   cause,
	}
}

func NewPermissionError(message string, cause error) *AuthError {
	return &AuthError{
		Code:    AuthErrorCodePermission,
		Message: message,
		Cause:   cause,
	}
}

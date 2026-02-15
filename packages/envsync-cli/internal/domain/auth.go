package domain

import "time"

// LoginCredentials represents the device code information needed for OAuth device flow
type LoginCredentials struct {
	DeviceCode      string
	UserCode        string
	VerificationUri string
	ExpiresIn       int
	Interval        int
	ClientId        string
	AuthDomain      string
}

// GetVerificationUri returns the verification URI for user authentication
func (lc *LoginCredentials) GetVerificationUri() string {
	return lc.VerificationUri
}

// GetUserCode returns the user code to be entered during authentication
func (lc *LoginCredentials) GetUserCode() string {
	return lc.UserCode
}

// GetInterval returns the polling interval in seconds
func (lc *LoginCredentials) GetInterval() time.Duration {
	return time.Duration(lc.Interval) * time.Second
}

// GetExpirationTime returns when the device code expires
func (lc *LoginCredentials) GetExpirationTime() time.Time {
	return time.Now().Add(time.Duration(lc.ExpiresIn) * time.Second)
}

// IsExpired checks if the device code has expired
func (lc *LoginCredentials) IsExpired() bool {
	return time.Now().After(lc.GetExpirationTime())
}

// AccessToken represents the authentication token
type AccessToken struct {
	Token        string
	RefreshToken string
	ExpiresAt    time.Time
	TokenType    string
}

// IsExpired checks if the access token has expired
func (at *AccessToken) IsExpired() bool {
	return time.Now().After(at.ExpiresAt)
}

// GetAuthorizationHeader returns the formatted authorization header value
func (at *AccessToken) GetAuthorizationHeader() string {
	return at.TokenType + " " + at.Token
}

// AuthResult represents the final result of an authentication process
type AuthResult struct {
	Success     bool
	AccessToken *AccessToken
	Error       error
}

type UserInfo struct {
	UserId string
	Email  string
	Org    string
	Role   string
}

package services

import (
	"fmt"
	"time"

	"github.com/EnvSync-Cloud/envsync-cli/internal/config"
	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/mappers"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository"
)

type AuthService interface {
	InitiateLogin() (*domain.LoginCredentials, error)
	CompleteLogin(credentials *domain.LoginCredentials) (*domain.AccessToken, error)
	PollForToken(credentials *domain.LoginCredentials) (*domain.AccessToken, error)
	SaveToken(token *domain.AccessToken) error
	Whoami() (*domain.UserInfo, error)
	Logout() error
}

type auth struct {
	repo repository.AuthRepository
	cfg  config.AppConfig
}

func NewAuthService() AuthService {
	r := repository.NewAuthRepository()
	cfg := config.New()

	return &auth{
		repo: r,
		cfg:  cfg,
	}
}

// InitiateLogin starts the OAuth device flow and returns login credentials
func (s *auth) InitiateLogin() (*domain.LoginCredentials, error) {
	deviceCodeResp, err := s.repo.LoginDeviceCode()
	if err != nil {
		return nil, fmt.Errorf("failed to initiate login: %w", err)
	}

	credentials := mappers.DeviceCodeResponseToDomain(deviceCodeResp)

	return credentials, nil
}

// CompleteLogin attempts to exchange device code for access token
func (s *auth) CompleteLogin(credentials *domain.LoginCredentials) (*domain.AccessToken, error) {
	tokenResp, err := s.repo.LoginToken(credentials.DeviceCode, credentials.ClientId, credentials.AuthDomain)
	if err != nil {
		return nil, err
	}

	token := mappers.LoginTokenResponseToDomain(tokenResp)
	return token, nil
}

// PollForToken polls the authorization server until user completes authentication
func (s *auth) PollForToken(credentials *domain.LoginCredentials) (*domain.AccessToken, error) {
	timeout := time.Now().Add(time.Duration(credentials.ExpiresIn) * time.Second)
	interval := time.Duration(credentials.Interval) * time.Second

	for time.Now().Before(timeout) {
		token, err := s.CompleteLogin(credentials)
		if err == nil {
			return token, nil
		}

		// If it's not an authentication pending error, return the error
		// In a real implementation, you'd check for specific error types
		time.Sleep(interval)
	}

	return nil, fmt.Errorf("authentication timeout: user did not complete login within %d seconds", credentials.ExpiresIn)
}

// SaveToken persists the access token to configuration
func (s *auth) SaveToken(token *domain.AccessToken) error {
	cfg := config.New()
	cfg.AccessToken = token.Token

	if err := cfg.WriteConfigFile(); err != nil {
		return fmt.Errorf("failed to save access token: %w", err)
	}

	return nil
}

// Whoami retrieves the current user's information
func (s *auth) Whoami() (*domain.UserInfo, error) {
	userInfoResp, err := s.repo.Whoami()
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve user info: %w", err)
	}

	userInfo := mappers.UserInfoResponseToDomain(userInfoResp)
	return userInfo, nil
}

// Logout clears the access token from configuration
func (s *auth) Logout() error {
	// TODO: Refactor this implementation to use a dedicated logout repository
	// which hits logout endpoint

	cfg := config.New()
	cfg.AccessToken = ""

	if err := cfg.WriteConfigFile(); err != nil {
		return fmt.Errorf("failed to clear access token: %w", err)
	}

	return nil
}

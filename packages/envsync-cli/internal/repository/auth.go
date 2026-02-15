package repository

import (
	"fmt"

	"resty.dev/v3"

	"github.com/EnvSync-Cloud/envsync-cli/internal/config"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

type AuthRepository interface {
	LoginDeviceCode() (responses.DeviceCodeResponse, error)
	LoginToken(deviceCode, clientID, authDomain string) (responses.LoginTokenResponse, error)
	Whoami() (responses.UserInfoResponse, error)
}

type authRepo struct {
	client *resty.Client
}

// NewAuthRepository creates a new instance of AuthRepository
func NewAuthRepository() AuthRepository {
	client := createHTTPClient()

	return &authRepo{
		client: client,
	}
}

// LoginDeviceCode retrieves a device code and verification uri for the authentication flow
func (s *authRepo) LoginDeviceCode() (responses.DeviceCodeResponse, error) {
	var resBody responses.DeviceCodeResponse

	res, err := s.client.
		R().
		SetResult(&resBody).
		Get("/access/cli")

	if err != nil {
		return responses.DeviceCodeResponse{}, fmt.Errorf("failed to get login URL: %w", err)
	}

	if res.StatusCode() != 201 {
		return responses.DeviceCodeResponse{}, fmt.Errorf("unexpected status code while fetching login URL: %d", res.StatusCode())
	}

	return resBody, nil
}

// LoginToken exchanges a device code for an authentication token
func (s *authRepo) LoginToken(deviceCode, clientID, authDomain string) (responses.LoginTokenResponse, error) {
	var resBody responses.LoginTokenResponse

	res, err := s.client.
		SetBaseURL("https://" + authDomain).
		R().
		SetResult(&resBody).
		SetFormData(map[string]string{
			"grant_type":  "urn:ietf:params:oauth:grant-type:device_code",
			"device_code": deviceCode,
			"client_id":   clientID,
		}).
		Post("/oauth/token")

	if err != nil {
		return responses.LoginTokenResponse{}, fmt.Errorf("failed to get login token: %w", err)
	}

	if res.StatusCode() != 200 {
		return responses.LoginTokenResponse{}, fmt.Errorf("unexpected status code while fetching login token: %d", res.StatusCode())
	}

	return resBody, nil
}

func (s *authRepo) Whoami() (responses.UserInfoResponse, error) {
	var resBody responses.UserInfoResponse

	res, err := s.client.
		R().
		SetAuthToken(config.New().AccessToken).
		SetResult(&resBody).
		Get("/auth/me")

	if err != nil {
		return responses.UserInfoResponse{}, fmt.Errorf("failed to get user info: %w", err)
	}

	if res.StatusCode() != 200 {
		return responses.UserInfoResponse{}, fmt.Errorf("unexpected status code while fetching user info: %d", res.StatusCode())
	}

	return resBody, nil
}

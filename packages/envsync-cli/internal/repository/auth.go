package repository

import (
	"context"
	"fmt"

	sdkclient "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/client"
	"github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk/option"
	"resty.dev/v3"

	config "github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/config"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/responses"
)

type AuthRepository interface {
	LoginDeviceCode() (responses.DeviceCodeResponse, error)
	LoginToken(deviceCode, clientID, TokenUrl string) (responses.LoginTokenResponse, error)
	Whoami() (responses.UserInfoResponse, error)
}

type authRepo struct {
	httpClient *resty.Client
	sdkClient  *sdkclient.Client
}

// NewAuthRepository creates a new instance of AuthRepository
func NewAuthRepository() AuthRepository {
	httpClient := createHTTPClient()
	sdkClient := createSDKClient()

	return &authRepo{
		httpClient: httpClient,
		sdkClient:  sdkClient,
	}
}

// LoginDeviceCode retrieves a device code and verification uri for the authentication flow
func (s *authRepo) LoginDeviceCode() (responses.DeviceCodeResponse, error) {
	resp, err := s.sdkClient.Access.CreateCliLogin(
		context.Background(),
		option.WithBaseURL(config.New().BackendURL),
	)
	if err != nil {
		return responses.DeviceCodeResponse{}, fmt.Errorf("failed to get login URL: %w", err)
	}

	extra := resp.GetExtraProperties()

	var result responses.DeviceCodeResponse
	result.Message = resp.GetMessage()
	if v, ok := extra["device_code"].(string); ok {
		result.DeviceCode = v
	}
	if v, ok := extra["user_code"].(string); ok {
		result.UserCode = v
	}
	if v, ok := extra["verification_uri_complete"].(string); ok {
		result.VerificationUri = v
	}
	if v, ok := extra["expires_in"].(float64); ok {
		result.ExpiresIn = int(v)
	}
	if v, ok := extra["interval"].(float64); ok {
		result.Interval = int(v)
	}
	if v, ok := extra["client_id"].(string); ok {
		result.ClientId = v
	}
	if v, ok := extra["token_url"].(string); ok {
		result.TokenUrl = v
	}

	return result, nil
}

// LoginToken exchanges a device code for an authentication token
func (s *authRepo) LoginToken(deviceCode, clientID, TokenUrl string) (responses.LoginTokenResponse, error) {
	var resBody responses.LoginTokenResponse

	res, err := s.httpClient.
		SetBaseURL(TokenUrl).
		R().
		SetResult(&resBody).
		SetFormData(map[string]string{
			"grant_type":  "urn:ietf:params:oauth:grant-type:device_code",
			"device_code": deviceCode,
			"client_id":   clientID,
		}).
		Post(TokenUrl)

	if err != nil {
		return responses.LoginTokenResponse{}, fmt.Errorf("failed to get login token: %w", err)
	}

	if res.StatusCode() != 200 {
		return responses.LoginTokenResponse{}, fmt.Errorf("unexpected status code while fetching login token: %d", res.StatusCode())
	}

	return resBody, nil
}

func (s *authRepo) Whoami() (responses.UserInfoResponse, error) {
	resp, err := s.sdkClient.Authentication.Whoami(context.Background(), option.WithBaseURL(config.New().BackendURL))
	if err != nil {
		return responses.UserInfoResponse{}, fmt.Errorf("failed to get user info: %w", err)
	}

	var result responses.UserInfoResponse

	if resp.User != nil {
		result.User.Id = resp.User.Id
		result.User.Email = resp.User.Email
		result.User.OrgId = resp.User.OrgId
		result.User.RoleId = resp.User.RoleId
		result.User.FullName = resp.User.FullName
		result.User.IsActive = resp.User.IsActive
		result.User.CreatedAt = resp.User.CreatedAt
		result.User.UpdatedAt = resp.User.UpdatedAt
		if resp.User.ProfilePictureUrl != nil {
			result.User.ProfilePictureUrl = *resp.User.ProfilePictureUrl
		}
	}

	if resp.Org != nil {
		result.Org.Id = resp.Org.Id
		result.Org.Name = resp.Org.Name
		result.Org.Slug = resp.Org.Slug
		result.Org.Metadata = resp.Org.Metadata
		result.Org.CreatedAt = resp.Org.CreatedAt
		result.Org.UpdatedAt = resp.Org.UpdatedAt
		if resp.Org.LogoUrl != nil {
			result.Org.LogoUrl = *resp.Org.LogoUrl
		}
		if resp.Org.Size != nil {
			result.Org.Size = *resp.Org.Size
		}
		if resp.Org.Website != nil {
			result.Org.Website = *resp.Org.Website
		}
	}

	if resp.Role != nil {
		result.Role.Id = resp.Role.Id
		result.Role.OrgId = resp.Role.OrgId
		result.Role.Name = resp.Role.Name
		result.Role.IsAdmin = resp.Role.IsAdmin
		result.Role.CanView = resp.Role.CanView
		result.Role.CanEdit = resp.Role.CanEdit
		result.Role.HavingBillingOptions = resp.Role.HaveBillingOptions
		result.Role.HavingApiAccess = resp.Role.HaveApiAccess
		result.Role.HavingWebhookAccess = resp.Role.HaveWebhookAccess
		result.Role.IsMaster = resp.Role.IsMaster
		result.Role.CreatedAt = resp.Role.CreatedAt
		result.Role.UpdatedAt = resp.Role.UpdatedAt
	}

	return result, nil
}

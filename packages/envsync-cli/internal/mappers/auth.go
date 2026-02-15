package mappers

import (
	"time"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/repository/responses"
)

// DeviceCodeResponseToDomain converts repository response to domain model
func DeviceCodeResponseToDomain(resp responses.DeviceCodeResponse) *domain.LoginCredentials {
	return &domain.LoginCredentials{
		DeviceCode:      resp.DeviceCode,
		UserCode:        resp.UserCode,
		VerificationUri: resp.VerificationUri,
		ExpiresIn:       resp.ExpiresIn,
		Interval:        resp.Interval,
		ClientId:        resp.ClientId,
		AuthDomain:      resp.AuthDomain,
	}
}

// LoginTokenResponseToDomain converts repository response to domain model
func LoginTokenResponseToDomain(resp responses.LoginTokenResponse) *domain.AccessToken {
	expiresAt := time.Now().Add(time.Duration(resp.ExpiresIn) * time.Second)

	return &domain.AccessToken{
		Token:        resp.AccessToken,
		RefreshToken: resp.RefreshToken,
		ExpiresAt:    expiresAt,
		TokenType:    resp.TokenType,
	}
}

// UserInfoResponseToDomain converts user info response to domain model
func UserInfoResponseToDomain(resp responses.UserInfoResponse) *domain.UserInfo {
	return &domain.UserInfo{
		UserId: resp.User.Id,
		Email:  resp.User.Email,
		Org:    resp.Org.Name,
		Role:   resp.Role.Name,
	}
}

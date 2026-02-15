package auth

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
)

// LoginUseCase defines the interface for user authentication
type LoginUseCase interface {
	Execute(context.Context) (*LoginResponse, error)
}

// LogoutUseCase defines the interface for user logout
type LogoutUseCase interface {
	Execute(context.Context) error
}

// WhoamiUseCase defines the interface for getting current user info
type WhoamiUseCase interface {
	Execute(context.Context) (*WhoamiResponse, error)
}

// Request/Response types

type LoginRequest struct{}

type LoginResponse struct {
	Success  bool             `json:"success"`
	Message  string           `json:"message"`
	UserInfo *domain.UserInfo `json:"user_info,omitempty"`
}

type LogoutRequest struct{}

type WhoamiRequest struct{}

type WhoamiResponse struct {
	UserInfo   *domain.UserInfo `json:"user_info,omitempty"`
	IsLoggedIn bool             `json:"is_logged_in"`
	TokenValid bool             `json:"token_valid"`
}

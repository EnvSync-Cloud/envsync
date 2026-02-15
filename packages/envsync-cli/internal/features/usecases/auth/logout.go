package auth

import (
	"context"
	"fmt"

	"github.com/EnvSync-Cloud/envsync-cli/internal/config"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

type logoutUseCase struct {
	authService services.AuthService
}

func NewLogoutUseCase() LogoutUseCase {
	service := services.NewAuthService()
	return &logoutUseCase{
		authService: service,
	}
}

func (uc *logoutUseCase) Execute(ctx context.Context) error {
	// Perform logout
	if err := uc.authService.Logout(); err != nil {
		return NewServiceError("failed to logout", err)
	}

	// Cleanup any local state
	if err := uc.cleanupLocalState(); err != nil {
		return NewServiceError("failed to cleanup local state after logout", err)
	}

	return nil
}

func (uc *logoutUseCase) cleanupLocalState() error {
	cfg := config.New()
	cfg.AccessToken = ""

	if err := cfg.WriteConfigFile(); err != nil {
		return fmt.Errorf("failed to clear access token: %w", err)
	}

	return nil
}

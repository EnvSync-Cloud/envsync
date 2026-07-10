package oidc

import (
	"context"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type updateOidcProviderUseCase struct {
	service services.OidcService
}

func NewUpdateOidcProviderUseCase() UpdateOidcProviderUseCase {
	return &updateOidcProviderUseCase{
		service: services.NewOidcService(),
	}
}

func (uc *updateOidcProviderUseCase) Execute(ctx context.Context, input domain.UpdateOidcProviderInput) error {
	ctx, span := telemetry.Tracer().Start(ctx, "oidc.update")
	defer span.End()

	if strings.TrimSpace(input.ID) == "" {
		return NewValidationError("provider ID is required", ErrProviderIDRequired)
	}

	if err := uc.service.UpdateProvider(ctx, input); err != nil {
		return NewServiceError("failed to update OIDC provider", err)
	}

	return nil
}

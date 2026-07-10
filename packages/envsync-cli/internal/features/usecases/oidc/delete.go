package oidc

import (
	"context"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type deleteOidcProviderUseCase struct {
	service services.OidcService
}

func NewDeleteOidcProviderUseCase() DeleteOidcProviderUseCase {
	return &deleteOidcProviderUseCase{
		service: services.NewOidcService(),
	}
}

func (uc *deleteOidcProviderUseCase) Execute(ctx context.Context, id string) error {
	ctx, span := telemetry.Tracer().Start(ctx, "oidc.delete")
	defer span.End()

	if strings.TrimSpace(id) == "" {
		return NewValidationError("provider ID is required", ErrProviderIDRequired)
	}

	if err := uc.service.DeleteProvider(ctx, id); err != nil {
		return NewServiceError("failed to delete OIDC provider", err)
	}

	return nil
}

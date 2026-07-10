package oidc

import (
	"context"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type getOidcProviderUseCase struct {
	service services.OidcService
}

func NewGetOidcProviderUseCase() GetOidcProviderUseCase {
	return &getOidcProviderUseCase{
		service: services.NewOidcService(),
	}
}

func (uc *getOidcProviderUseCase) Execute(ctx context.Context, id string) (*domain.OidcProvider, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "oidc.get")
	defer span.End()

	if strings.TrimSpace(id) == "" {
		return nil, NewValidationError("provider ID is required", ErrProviderIDRequired)
	}

	provider, err := uc.service.GetProvider(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to get OIDC provider", err)
	}

	return provider, nil
}

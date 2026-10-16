package oidc

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type listOidcProvidersUseCase struct {
	service services.OidcService
}

func NewListOidcProvidersUseCase() ListOidcProvidersUseCase {
	return &listOidcProvidersUseCase{
		service: services.NewOidcService(),
	}
}

func (uc *listOidcProvidersUseCase) Execute(ctx context.Context) (result []domain.OidcProvider, err error) {
	ctx, end := telemetry.StartSpan(ctx, "oidc.list")
	defer end(&err)

	providers, err := uc.service.ListProviders(ctx)
	if err != nil {
		return nil, NewServiceError("failed to list OIDC providers", err)
	}

	return providers, nil
}

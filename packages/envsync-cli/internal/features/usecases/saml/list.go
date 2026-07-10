package saml

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type listSamlProvidersUseCase struct {
	service services.SamlService
}

func NewListSamlProvidersUseCase() ListSamlProvidersUseCase {
	return &listSamlProvidersUseCase{
		service: services.NewSamlService(),
	}
}

func (uc *listSamlProvidersUseCase) Execute(ctx context.Context) ([]domain.SamlProvider, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "saml.list")
	defer span.End()

	providers, err := uc.service.ListProviders(ctx)
	if err != nil {
		return nil, NewServiceError("failed to list SAML providers", err)
	}

	return providers, nil
}

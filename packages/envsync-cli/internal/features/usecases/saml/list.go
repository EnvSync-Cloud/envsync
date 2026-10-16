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

func (uc *listSamlProvidersUseCase) Execute(ctx context.Context) (result []domain.SamlProvider, err error) {
	ctx, end := telemetry.StartSpan(ctx, "saml.list")
	defer end(&err)

	providers, err := uc.service.ListProviders(ctx)
	if err != nil {
		return nil, NewServiceError("failed to list SAML providers", err)
	}

	return providers, nil
}

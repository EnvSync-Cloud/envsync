package saml

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
)

type CreateSamlProviderUseCase interface {
	Execute(ctx context.Context, input domain.CreateSamlProviderInput) (*domain.SamlProvider, error)
}

type ListSamlProvidersUseCase interface {
	Execute(ctx context.Context) ([]domain.SamlProvider, error)
}

type GetSamlProviderUseCase interface {
	Execute(ctx context.Context, id string) (*domain.SamlProvider, error)
}

type UpdateSamlProviderUseCase interface {
	Execute(ctx context.Context, input domain.UpdateSamlProviderInput) error
}

type DeleteSamlProviderUseCase interface {
	Execute(ctx context.Context, id string) error
}

type GetSamlMetadataUseCase interface {
	Execute(ctx context.Context, id string) error
}

type InitiateSamlSsoUseCase interface {
	Execute(ctx context.Context, providerID string) (*domain.SamlSsoResult, error)
}

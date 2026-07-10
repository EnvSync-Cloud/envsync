package oidc

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
)

type CreateOidcProviderUseCase interface {
	Execute(ctx context.Context, input domain.CreateOidcProviderInput) (*domain.OidcProvider, error)
}

type ListOidcProvidersUseCase interface {
	Execute(ctx context.Context) ([]domain.OidcProvider, error)
}

type GetOidcProviderUseCase interface {
	Execute(ctx context.Context, id string) (*domain.OidcProvider, error)
}

type UpdateOidcProviderUseCase interface {
	Execute(ctx context.Context, input domain.UpdateOidcProviderInput) error
}

type DeleteOidcProviderUseCase interface {
	Execute(ctx context.Context, id string) error
}

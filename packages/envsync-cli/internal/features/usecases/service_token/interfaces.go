package service_token

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
)

type CreateServiceTokenUseCase interface {
	Execute(ctx context.Context, req *domain.ServiceToken) (*domain.ServiceToken, error)
}

type ListServiceTokensUseCase interface {
	Execute(ctx context.Context) ([]domain.ServiceToken, error)
}

type GetServiceTokenUseCase interface {
	Execute(ctx context.Context, id string) (*domain.ServiceToken, error)
}

type DeleteServiceTokenUseCase interface {
	Execute(ctx context.Context, id string) error
}

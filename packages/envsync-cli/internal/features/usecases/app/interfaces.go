package app

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
)

// CreateAppUseCase defines the interface for creating applications
type CreateAppUseCase interface {
	Execute(context.Context, domain.Application) (*domain.Application, error)
}

// DeleteAppUseCase defines the interface for deleting applications
type DeleteAppUseCase interface {
	Execute(context.Context) ([]domain.Application, error)
}

// ListAppsUseCase defines the interface for listing applications
type ListAppsUseCase interface {
	Execute(context.Context) ([]domain.Application, error)
}

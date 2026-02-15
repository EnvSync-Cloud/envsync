package environment

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
)

type GetEnvUseCase interface {
	ExecuteByAppID(context.Context, string) ([]domain.EnvType, error)
	ExecuteByID(context.Context, string) (domain.EnvType, error)
}

type SwitchEnvUseCase interface {
	Execute(context.Context, domain.EnvType) error
}

type DeleteEnvUseCase interface {
	Execute(context.Context, string) error
}

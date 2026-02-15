package run

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
)

type ReadConfigUseCase interface {
	Execute(context.Context) (*domain.SyncConfig, error)
}

type FetchAppUseCase interface {
	Execute(context.Context, string) (*domain.Application, error)
}

type InjectEnvUseCase interface {
	Execute(context.Context) (map[string]string, error)
}

type InjectSecretsUseCase interface {
	Execute(context.Context) (map[string]string, error)
}

type RedactUseCase interface {
	Execute(context.Context, []string, map[string]string) int
}

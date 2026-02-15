package sync

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
)

type PushUseCase interface {
	Execute(context.Context, string) (SyncResponse, error)
}

type PullUseCase interface {
	Execute(context.Context, string) (SyncResponse, error)
}

type SyncResponse struct {
	Added     []domain.EnvironmentVariable `json:"added"`
	Updated   []domain.EnvironmentVariable `json:"updated"`
	Deleted   []domain.EnvironmentVariable `json:"deleted"`
	Conflicts []domain.EnvironmentVariable `json:"conflicts"`
	Warnings  []string                     `json:"warnings,omitempty"`
}

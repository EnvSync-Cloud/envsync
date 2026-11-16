package gpg_key

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type listKeysUseCase struct {
	service services.GpgKeyService
}

func NewListKeysUseCase() ListKeysUseCase {
	service := services.NewGpgKeyService()
	return &listKeysUseCase{service: service}
}

func (uc *listKeysUseCase) Execute(ctx context.Context) (result []domain.GpgKey, err error) {
	ctx, end := telemetry.StartSpan(ctx, "gpg_key.list_keys")
	defer end(&err)

	keys, err := uc.service.ListKeys(ctx)
	if err != nil {
		return nil, NewServiceError("failed to list GPG keys", err)
	}
	return keys, nil
}

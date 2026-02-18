package gpg_key

import (
	"context"

	"github.com/EnvSync-Cloud/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync-cli/internal/services"
)

type listKeysUseCase struct {
	service services.GpgKeyService
}

func NewListKeysUseCase() ListKeysUseCase {
	service := services.NewGpgKeyService()
	return &listKeysUseCase{service: service}
}

func (uc *listKeysUseCase) Execute(ctx context.Context) ([]domain.GpgKey, error) {
	keys, err := uc.service.ListKeys()
	if err != nil {
		return nil, NewServiceError("failed to list GPG keys", err)
	}
	return keys, nil
}

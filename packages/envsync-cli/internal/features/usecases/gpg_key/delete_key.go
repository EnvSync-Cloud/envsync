package gpg_key

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

type deleteKeyUseCase struct {
	service services.GpgKeyService
}

func NewDeleteKeyUseCase() DeleteKeyUseCase {
	service := services.NewGpgKeyService()
	return &deleteKeyUseCase{service: service}
}

func (uc *deleteKeyUseCase) Execute(ctx context.Context, keyID string) error {
	if keyID == "" {
		return NewValidationError("key ID is required", ErrKeyIDRequired)
	}

	if err := uc.service.DeleteKey(keyID); err != nil {
		return NewServiceError("failed to delete GPG key", err)
	}

	return nil
}

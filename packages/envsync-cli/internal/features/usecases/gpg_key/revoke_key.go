package gpg_key

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

type revokeUseCase struct {
	service services.GpgKeyService
}

func NewRevokeUseCase() RevokeUseCase {
	service := services.NewGpgKeyService()
	return &revokeUseCase{service: service}
}

func (uc *revokeUseCase) Execute(ctx context.Context, keyID, reason string) (*domain.GpgKey, error) {
	if keyID == "" {
		return nil, NewValidationError("key ID is required", ErrKeyIDRequired)
	}

	key, err := uc.service.RevokeKey(ctx, keyID, reason)
	if err != nil {
		return nil, NewServiceError("failed to revoke GPG key", err)
	}

	return &key, nil
}

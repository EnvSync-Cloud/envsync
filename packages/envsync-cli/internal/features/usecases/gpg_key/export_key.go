package gpg_key

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

type exportUseCase struct {
	service services.GpgKeyService
}

func NewExportUseCase() ExportUseCase {
	service := services.NewGpgKeyService()
	return &exportUseCase{service: service}
}

func (uc *exportUseCase) Execute(ctx context.Context, keyID string) (string, string, error) {
	if keyID == "" {
		return "", "", NewValidationError("key ID is required", ErrKeyIDRequired)
	}

	publicKey, fingerprint, err := uc.service.ExportKey(ctx, keyID)
	if err != nil {
		return "", "", NewServiceError("failed to export GPG key", err)
	}

	return publicKey, fingerprint, nil
}

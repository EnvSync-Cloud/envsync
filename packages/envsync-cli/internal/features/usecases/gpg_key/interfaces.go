package gpg_key

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
)

type ListKeysUseCase interface {
	Execute(ctx context.Context) ([]domain.GpgKey, error)
}

type GenerateKeyUseCase interface {
	Execute(ctx context.Context, name, email, algorithm string, keySize, expiresInDays *int, usageFlags []string, isDefault bool) (*domain.GpgKey, error)
}

type SignUseCase interface {
	Execute(ctx context.Context, keyID, filePath, mode string, detached bool, useStdin bool) (*domain.GpgSignatureResult, error)
}

type VerifyUseCase interface {
	Execute(ctx context.Context, filePath, signaturePath, keyID string) (*domain.GpgVerifyResult, error)
}

type ExportUseCase interface {
	Execute(ctx context.Context, keyID string) (publicKey string, fingerprint string, err error)
}

type RevokeUseCase interface {
	Execute(ctx context.Context, keyID, reason string) (*domain.GpgKey, error)
}

type DeleteKeyUseCase interface {
	Execute(ctx context.Context, keyID string) error
}

package gpg_key

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/repository/requests"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
)

type generateKeyUseCase struct {
	service services.GpgKeyService
}

func NewGenerateKeyUseCase() GenerateKeyUseCase {
	service := services.NewGpgKeyService()
	return &generateKeyUseCase{service: service}
}

func (uc *generateKeyUseCase) Execute(ctx context.Context, name, email, algorithm string, expiresInDays *int, usageFlags []string, isDefault bool) (*domain.GpgKey, error) {
	if name == "" {
		return nil, NewValidationError("name is required", ErrNameRequired)
	}
	if email == "" {
		return nil, NewValidationError("email is required", ErrEmailRequired)
	}

	opt, ok := domain.ResolveGpgAlgorithm(algorithm)
	if !ok {
		return nil, NewValidationError("algorithm must be one of ECC Curve25519, ECC P-256, ECC P-384, RSA 4096", ErrInvalidAlgorithm)
	}

	if usageFlags == nil {
		usageFlags = []string{"sign"}
	}

	req := requests.GenerateGpgKeyRequest{
		Name:          name,
		Email:         email,
		Algorithm:     opt.Value,
		KeySize:       opt.KeySize,
		UsageFlags:    usageFlags,
		ExpiresInDays: expiresInDays,
		IsDefault:     isDefault,
	}

	key, err := uc.service.GenerateKey(ctx, req)
	if err != nil {
		return nil, NewServiceError("failed to generate GPG key", err)
	}

	return &key, nil
}

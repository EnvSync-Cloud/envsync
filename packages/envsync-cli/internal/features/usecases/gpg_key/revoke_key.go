package gpg_key

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type revokeUseCase struct {
	service services.GpgKeyService
}

func NewRevokeUseCase() RevokeUseCase {
	service := services.NewGpgKeyService()
	return &revokeUseCase{service: service}
}

func (uc *revokeUseCase) Execute(ctx context.Context, keyID, reason string) (result *domain.GpgKey, err error) {
	ctx, end := telemetry.StartSpan(ctx, "gpg_key.revoke_key",
		trace.WithAttributes(attribute.String("key.id", keyID)))
	defer end(&err)

	if keyID == "" {
		return nil, NewValidationError("key ID is required", ErrKeyIDRequired)
	}

	key, err := uc.service.RevokeKey(ctx, keyID, reason)
	if err != nil {
		return nil, NewServiceError("failed to revoke GPG key", err)
	}

	return &key, nil
}

package gpg_key

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type deleteKeyUseCase struct {
	service services.GpgKeyService
}

func NewDeleteKeyUseCase() DeleteKeyUseCase {
	service := services.NewGpgKeyService()
	return &deleteKeyUseCase{service: service}
}

func (uc *deleteKeyUseCase) Execute(ctx context.Context, keyID string) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "gpg_key.delete_key",
		trace.WithAttributes(attribute.String("key.id", keyID)))
	defer end(&err)

	if keyID == "" {
		return NewValidationError("key ID is required", ErrKeyIDRequired)
	}

	if err := uc.service.DeleteKey(ctx, keyID); err != nil {
		return NewServiceError("failed to delete GPG key", err)
	}

	return nil
}

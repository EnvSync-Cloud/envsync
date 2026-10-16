package gpg_key

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type exportUseCase struct {
	service services.GpgKeyService
}

func NewExportUseCase() ExportUseCase {
	service := services.NewGpgKeyService()
	return &exportUseCase{service: service}
}

func (uc *exportUseCase) Execute(ctx context.Context, keyID string) (exportedPublicKey, exportedFingerprint string, err error) {
	ctx, end := telemetry.StartSpan(ctx, "gpg_key.export_key",
		trace.WithAttributes(attribute.String("key.id", keyID)))
	defer end(&err)

	if keyID == "" {
		return "", "", NewValidationError("key ID is required", ErrKeyIDRequired)
	}

	publicKey, fingerprint, err := uc.service.ExportKey(ctx, keyID)
	if err != nil {
		return "", "", NewServiceError("failed to export GPG key", err)
	}

	return publicKey, fingerprint, nil
}

package oidc

import (
	"context"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type deleteOidcProviderUseCase struct {
	service services.OidcService
}

func NewDeleteOidcProviderUseCase() DeleteOidcProviderUseCase {
	return &deleteOidcProviderUseCase{
		service: services.NewOidcService(),
	}
}

func (uc *deleteOidcProviderUseCase) Execute(ctx context.Context, id string) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "oidc.delete", trace.WithAttributes(attribute.String("provider.id", id)))
	defer end(&err)

	if strings.TrimSpace(id) == "" {
		return NewValidationError("provider ID is required", ErrProviderIDRequired)
	}

	if err := uc.service.DeleteProvider(ctx, id); err != nil {
		return NewServiceError("failed to delete OIDC provider", err)
	}

	return nil
}

package oidc

import (
	"context"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type updateOidcProviderUseCase struct {
	service services.OidcService
}

func NewUpdateOidcProviderUseCase() UpdateOidcProviderUseCase {
	return &updateOidcProviderUseCase{
		service: services.NewOidcService(),
	}
}

func (uc *updateOidcProviderUseCase) Execute(ctx context.Context, input domain.UpdateOidcProviderInput) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "oidc.update", trace.WithAttributes(attribute.String("provider.id", input.ID)))
	defer end(&err)

	if strings.TrimSpace(input.ID) == "" {
		return NewValidationError("provider ID is required", ErrProviderIDRequired)
	}

	if err := uc.service.UpdateProvider(ctx, input); err != nil {
		return NewServiceError("failed to update OIDC provider", err)
	}

	return nil
}

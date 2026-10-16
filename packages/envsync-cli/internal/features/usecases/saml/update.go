package saml

import (
	"context"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type updateSamlProviderUseCase struct {
	service services.SamlService
}

func NewUpdateSamlProviderUseCase() UpdateSamlProviderUseCase {
	return &updateSamlProviderUseCase{
		service: services.NewSamlService(),
	}
}

func (uc *updateSamlProviderUseCase) Execute(ctx context.Context, input domain.UpdateSamlProviderInput) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "saml.update",
		trace.WithAttributes(
			attribute.String("provider.id", input.ID),
			attribute.String("provider.name", input.Name),
			attribute.String("provider.entity_id", input.EntityID),
		))
	defer end(&err)

	if strings.TrimSpace(input.ID) == "" {
		return NewValidationError("provider ID is required", ErrProviderIDRequired)
	}

	if err := uc.service.UpdateProvider(ctx, input); err != nil {
		return NewServiceError("failed to update SAML provider", err)
	}

	return nil
}

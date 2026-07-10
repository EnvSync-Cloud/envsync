package saml

import (
	"context"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type updateSamlProviderUseCase struct {
	service services.SamlService
}

func NewUpdateSamlProviderUseCase() UpdateSamlProviderUseCase {
	return &updateSamlProviderUseCase{
		service: services.NewSamlService(),
	}
}

func (uc *updateSamlProviderUseCase) Execute(ctx context.Context, input domain.UpdateSamlProviderInput) error {
	ctx, span := telemetry.Tracer().Start(ctx, "saml.update")
	defer span.End()

	if strings.TrimSpace(input.ID) == "" {
		return NewValidationError("provider ID is required", ErrProviderIDRequired)
	}

	if err := uc.service.UpdateProvider(ctx, input); err != nil {
		return NewServiceError("failed to update SAML provider", err)
	}

	return nil
}

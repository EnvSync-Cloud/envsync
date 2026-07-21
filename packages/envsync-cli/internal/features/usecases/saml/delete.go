package saml

import (
	"context"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type deleteSamlProviderUseCase struct {
	service services.SamlService
}

func NewDeleteSamlProviderUseCase() DeleteSamlProviderUseCase {
	return &deleteSamlProviderUseCase{
		service: services.NewSamlService(),
	}
}

func (uc *deleteSamlProviderUseCase) Execute(ctx context.Context, id string) error {
	ctx, span := telemetry.Tracer().Start(ctx, "saml.delete")
	defer span.End()

	if strings.TrimSpace(id) == "" {
		return NewValidationError("provider ID is required", ErrProviderIDRequired)
	}

	if err := uc.service.DeleteProvider(ctx, id); err != nil {
		return NewServiceError("failed to delete SAML provider", err)
	}

	return nil
}

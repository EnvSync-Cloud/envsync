package saml

import (
	"context"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type getSamlMetadataUseCase struct {
	service services.SamlService
}

func NewGetSamlMetadataUseCase() GetSamlMetadataUseCase {
	return &getSamlMetadataUseCase{
		service: services.NewSamlService(),
	}
}

func (uc *getSamlMetadataUseCase) Execute(ctx context.Context, id string) error {
	ctx, span := telemetry.Tracer().Start(ctx, "saml.metadata")
	defer span.End()

	if strings.TrimSpace(id) == "" {
		return NewValidationError("provider ID is required", ErrProviderIDRequired)
	}

	if err := uc.service.GetMetadata(ctx, id); err != nil {
		return NewServiceError("failed to get SAML metadata", err)
	}

	return nil
}

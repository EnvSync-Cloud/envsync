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

func (uc *getSamlMetadataUseCase) Execute(ctx context.Context, orgSlug string) (string, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "saml.metadata")
	defer span.End()

	if strings.TrimSpace(orgSlug) == "" {
		return "", NewValidationError("organization slug is required", ErrOrgSlugRequired)
	}

	xml, err := uc.service.GetMetadata(ctx, orgSlug)
	if err != nil {
		return "", NewServiceError("failed to get SAML metadata", err)
	}

	return xml, nil
}

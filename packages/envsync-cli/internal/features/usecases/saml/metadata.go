package saml

import (
	"context"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

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

func (uc *getSamlMetadataUseCase) Execute(ctx context.Context, orgSlug string) (result string, err error) {
	ctx, end := telemetry.StartSpan(ctx, "saml.metadata",
		trace.WithAttributes(attribute.String("org.slug", orgSlug)))
	defer end(&err)

	if strings.TrimSpace(orgSlug) == "" {
		return "", NewValidationError("organization slug is required", ErrOrgSlugRequired)
	}

	xml, err := uc.service.GetMetadata(ctx, orgSlug)
	if err != nil {
		return "", NewServiceError("failed to get SAML metadata", err)
	}

	return xml, nil
}

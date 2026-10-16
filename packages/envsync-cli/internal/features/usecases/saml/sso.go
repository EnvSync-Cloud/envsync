package saml

import (
	"context"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type initiateSamlSsoUseCase struct {
	service services.SamlService
}

func NewInitiateSamlSsoUseCase() InitiateSamlSsoUseCase {
	return &initiateSamlSsoUseCase{
		service: services.NewSamlService(),
	}
}

func (uc *initiateSamlSsoUseCase) Execute(ctx context.Context, orgSlug string, providerID string) (resp *domain.SamlSsoResult, err error) {
	ctx, end := telemetry.StartSpan(ctx, "saml.sso",
		trace.WithAttributes(
			attribute.String("org.slug", orgSlug),
			attribute.String("provider.id", providerID),
		))
	defer end(&err)

	if strings.TrimSpace(orgSlug) == "" {
		return nil, NewValidationError("organization slug is required", ErrOrgSlugRequired)
	}

	result, err := uc.service.InitiateSso(ctx, orgSlug, providerID)
	if err != nil {
		return nil, NewServiceError("failed to initiate SAML SSO", err)
	}

	return result, nil
}

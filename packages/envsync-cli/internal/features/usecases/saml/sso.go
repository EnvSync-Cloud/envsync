package saml

import (
	"context"
	"strings"

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

func (uc *initiateSamlSsoUseCase) Execute(ctx context.Context, orgSlug string, providerID string) (*domain.SamlSsoResult, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "saml.sso")
	defer span.End()

	if strings.TrimSpace(orgSlug) == "" {
		return nil, NewValidationError("organization slug is required", ErrOrgSlugRequired)
	}

	result, err := uc.service.InitiateSso(ctx, orgSlug, providerID)
	if err != nil {
		return nil, NewServiceError("failed to initiate SAML SSO", err)
	}

	return result, nil
}

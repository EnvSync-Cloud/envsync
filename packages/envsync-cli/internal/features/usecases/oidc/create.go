package oidc

import (
	"context"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type createOidcProviderUseCase struct {
	service services.OidcService
}

func NewCreateOidcProviderUseCase() CreateOidcProviderUseCase {
	return &createOidcProviderUseCase{
		service: services.NewOidcService(),
	}
}

func (uc *createOidcProviderUseCase) Execute(ctx context.Context, input domain.CreateOidcProviderInput) (*domain.OidcProvider, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "oidc.create")
	defer span.End()

	if err := uc.validateInput(input); err != nil {
		return nil, err
	}

	provider, err := uc.service.CreateProvider(ctx, input)
	if err != nil {
		return nil, NewServiceError("failed to create OIDC provider", err)
	}

	return provider, nil
}

func (uc *createOidcProviderUseCase) validateInput(input domain.CreateOidcProviderInput) error {
	if strings.TrimSpace(input.ProviderType) == "" {
		return NewValidationError("provider type is required", ErrProviderTypeRequired)
	}
	if strings.TrimSpace(input.IssuerURL) == "" {
		return NewValidationError("issuer URL is required", ErrIssuerURLRequired)
	}
	if strings.TrimSpace(input.Audience) == "" {
		return NewValidationError("audience is required", ErrAudienceRequired)
	}

	validTypes := map[string]bool{
		"github_actions": true,
		"gitlab_ci":      true,
		"kubernetes":     true,
		"generic":        true,
	}
	if !validTypes[input.ProviderType] {
		return NewValidationError("invalid provider type", ErrInvalidProviderType)
	}

	return nil
}

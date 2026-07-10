package saml

import (
	"context"
	"strings"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type createSamlProviderUseCase struct {
	service services.SamlService
}

func NewCreateSamlProviderUseCase() CreateSamlProviderUseCase {
	return &createSamlProviderUseCase{
		service: services.NewSamlService(),
	}
}

func (uc *createSamlProviderUseCase) Execute(ctx context.Context, input domain.CreateSamlProviderInput) (*domain.SamlProvider, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "saml.create")
	defer span.End()

	if err := uc.validateInput(input); err != nil {
		return nil, err
	}

	provider, err := uc.service.CreateProvider(ctx, input)
	if err != nil {
		return nil, NewServiceError("failed to create SAML provider", err)
	}

	return provider, nil
}

func (uc *createSamlProviderUseCase) validateInput(input domain.CreateSamlProviderInput) error {
	if strings.TrimSpace(input.ProviderType) == "" {
		return NewValidationError("provider type is required", ErrProviderTypeRequired)
	}
	if strings.TrimSpace(input.Name) == "" {
		return NewValidationError("name is required", ErrNameRequired)
	}
	if strings.TrimSpace(input.EntityID) == "" {
		return NewValidationError("entity ID is required", ErrEntityIDRequired)
	}
	if strings.TrimSpace(input.SsoURL) == "" {
		return NewValidationError("SSO URL is required", ErrSsoURLRequired)
	}
	if strings.TrimSpace(input.Certificate) == "" {
		return NewValidationError("certificate is required", ErrCertificateRequired)
	}

	validTypes := map[string]bool{
		"okta":             true,
		"onelogin":         true,
		"azure-ad":         true,
		"google-workspace": true,
		"duo":              true,
		"rippling":         true,
		"oracle":           true,
		"ping-identity":    true,
	}
	if !validTypes[input.ProviderType] {
		return NewValidationError("invalid provider type", ErrInvalidProviderType)
	}

	return nil
}

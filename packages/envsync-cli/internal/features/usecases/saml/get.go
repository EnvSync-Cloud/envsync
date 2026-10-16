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

type getSamlProviderUseCase struct {
	service services.SamlService
}

func NewGetSamlProviderUseCase() GetSamlProviderUseCase {
	return &getSamlProviderUseCase{
		service: services.NewSamlService(),
	}
}

func (uc *getSamlProviderUseCase) Execute(ctx context.Context, id string) (result *domain.SamlProvider, err error) {
	ctx, end := telemetry.StartSpan(ctx, "saml.get",
		trace.WithAttributes(attribute.String("provider.id", id)))
	defer end(&err)

	if strings.TrimSpace(id) == "" {
		return nil, NewValidationError("provider ID is required", ErrProviderIDRequired)
	}

	provider, err := uc.service.GetProvider(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to get SAML provider", err)
	}

	return provider, nil
}

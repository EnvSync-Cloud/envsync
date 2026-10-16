package oidc

import (
	"context"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type getOidcProviderUseCase struct {
	service services.OidcService
}

func NewGetOidcProviderUseCase() GetOidcProviderUseCase {
	return &getOidcProviderUseCase{
		service: services.NewOidcService(),
	}
}

func (uc *getOidcProviderUseCase) Execute(ctx context.Context, id string) (result *domain.OidcProvider, err error) {
	ctx, end := telemetry.StartSpan(ctx, "oidc.get", trace.WithAttributes(attribute.String("provider.id", id)))
	defer end(&err)

	if strings.TrimSpace(id) == "" {
		return nil, NewValidationError("provider ID is required", ErrProviderIDRequired)
	}

	provider, err := uc.service.GetProvider(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to get OIDC provider", err)
	}

	return provider, nil
}

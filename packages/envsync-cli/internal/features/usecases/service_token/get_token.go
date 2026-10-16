package service_token

import (
	"context"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/domain"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type getServiceTokenUseCase struct {
	service services.ServiceTokenService
}

func NewGetServiceTokenUseCase() GetServiceTokenUseCase {
	return &getServiceTokenUseCase{
		service: services.NewServiceTokenService(),
	}
}

func (uc *getServiceTokenUseCase) Execute(ctx context.Context, id string) (result *domain.ServiceToken, err error) {
	ctx, end := telemetry.StartSpan(ctx, "service_token.get", trace.WithAttributes(attribute.String("token.id", id)))
	defer end(&err)

	if strings.TrimSpace(id) == "" {
		return nil, NewServiceTokenValidationError("service token ID is required", ErrTokenIDRequired)
	}

	token, err := uc.service.GetServiceToken(ctx, id)
	if err != nil {
		return nil, NewServiceTokenServiceError("failed to get service token", err)
	}

	return &token, nil
}

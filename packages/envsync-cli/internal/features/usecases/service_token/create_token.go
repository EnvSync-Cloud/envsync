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

type createServiceTokenUseCase struct {
	service services.ServiceTokenService
}

func NewCreateServiceTokenUseCase() CreateServiceTokenUseCase {
	return &createServiceTokenUseCase{
		service: services.NewServiceTokenService(),
	}
}

func (uc *createServiceTokenUseCase) Execute(ctx context.Context, st *domain.ServiceToken) (result *domain.ServiceToken, err error) {
	ctx, end := telemetry.StartSpan(ctx, "service_token.create", trace.WithAttributes(
		attribute.String("token.name", st.Name),
		attribute.String("app.id", st.AppID),
		attribute.String("env.id", st.EnvTypeID),
	))
	defer end(&err)

	if strings.TrimSpace(st.Name) == "" {
		return nil, NewServiceTokenValidationError("service token name cannot be empty", ErrTokenNameRequired)
	}

	resp, err := uc.service.CreateServiceToken(ctx, st)
	if err != nil {
		return nil, NewServiceTokenServiceError("failed to create service token", err)
	}

	return &resp, nil
}

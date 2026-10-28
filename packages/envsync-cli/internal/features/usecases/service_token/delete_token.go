package service_token

import (
	"context"
	"strings"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type deleteServiceTokenUseCase struct {
	service services.ServiceTokenService
}

func NewDeleteServiceTokenUseCase() DeleteServiceTokenUseCase {
	return &deleteServiceTokenUseCase{
		service: services.NewServiceTokenService(),
	}
}

func (uc *deleteServiceTokenUseCase) Execute(ctx context.Context, id string) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "service_token.delete", trace.WithAttributes(attribute.String("token.id", id)))
	defer end(&err)

	if strings.TrimSpace(id) == "" {
		return NewServiceTokenValidationError("service token ID is required", ErrTokenIDRequired)
	}

	if err := uc.service.DeleteServiceToken(ctx, id); err != nil {
		return NewServiceTokenServiceError("failed to delete service token", err)
	}

	return nil
}

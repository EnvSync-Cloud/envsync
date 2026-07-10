package service_token

import (
	"context"
	"strings"

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

func (uc *deleteServiceTokenUseCase) Execute(ctx context.Context, id string) error {
	ctx, span := telemetry.Tracer().Start(ctx, "service_token.delete")
	defer span.End()

	if strings.TrimSpace(id) == "" {
		return NewServiceTokenValidationError("service token ID is required", ErrTokenIDRequired)
	}

	if err := uc.service.DeleteServiceToken(ctx, id); err != nil {
		return NewServiceTokenServiceError("failed to delete service token", err)
	}

	return nil
}

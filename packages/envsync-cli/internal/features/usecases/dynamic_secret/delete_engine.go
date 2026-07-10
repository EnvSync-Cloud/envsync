package dynamic_secret

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type deleteEngineUseCase struct {
	dynamicSecretService services.DynamicSecretService
}

func NewDeleteEngineUseCase() DeleteEngineUseCase {
	return &deleteEngineUseCase{
		dynamicSecretService: services.NewDynamicSecretService(),
	}
}

func (uc *deleteEngineUseCase) Execute(ctx context.Context, id string) error {
	ctx, span := telemetry.Tracer().Start(ctx, "dynamic_secret.delete_engine")
	defer span.End()

	if id == "" {
		return NewValidationError("engine ID is required", ErrIDRequired)
	}

	_, err := uc.dynamicSecretService.DeleteEngine(ctx, id)
	if err != nil {
		return NewServiceError("failed to delete dynamic secret engine", err)
	}

	return nil
}

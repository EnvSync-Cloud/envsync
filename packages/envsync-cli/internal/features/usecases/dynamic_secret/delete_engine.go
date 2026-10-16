package dynamic_secret

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

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

func (uc *deleteEngineUseCase) Execute(ctx context.Context, id string) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "dynamic_secret.delete_engine", trace.WithAttributes(attribute.String("engine.id", id)))
	defer end(&err)

	if id == "" {
		return NewValidationError("engine ID is required", ErrIDRequired)
	}

	_, err = uc.dynamicSecretService.DeleteEngine(ctx, id)
	if err != nil {
		return NewServiceError("failed to delete dynamic secret engine", err)
	}

	return nil
}

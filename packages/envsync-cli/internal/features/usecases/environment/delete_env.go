package environment

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type deleteEnvUseCase struct {
	envService services.EnvTypeService
}

func NewDeleteEnvUseCase() DeleteEnvUseCase {
	service := services.NewEnvTypeService()
	return &deleteEnvUseCase{
		envService: service,
	}
}

func (uc *deleteEnvUseCase) Execute(ctx context.Context, id string) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "environment.delete",
		trace.WithAttributes(attribute.String("env.id", id)))
	defer end(&err)

	if err := uc.envService.DeleteEnvType(ctx, id); err != nil {
		return NewServiceError("failed to delete environment", err)
	}
	return nil
}

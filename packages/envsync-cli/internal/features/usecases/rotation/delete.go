package rotation

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type deletePolicyUseCase struct {
	rotationService services.RotationService
}

func NewDeletePolicyUseCase() DeletePolicyUseCase {
	return &deletePolicyUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *deletePolicyUseCase) Execute(ctx context.Context, id string) (err error) {
	ctx, end := telemetry.StartSpan(ctx, "rotation.delete",
		trace.WithAttributes(attribute.String("rotation.id", id)))
	defer end(&err)

	if id == "" {
		return NewValidationError("rotation policy ID is required", ErrIDRequired)
	}

	_, err = uc.rotationService.DeletePolicy(ctx, id)
	if err != nil {
		return NewServiceError("failed to delete rotation policy", err)
	}

	return nil
}

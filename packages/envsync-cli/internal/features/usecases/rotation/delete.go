package rotation

import (
	"context"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type deletePolicyUseCase struct {
	rotationService services.RotationService
}

func NewDeletePolicyUseCase() DeletePolicyUseCase {
	return &deletePolicyUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *deletePolicyUseCase) Execute(ctx context.Context, id string) error {
	ctx, span := telemetry.Tracer().Start(ctx, "rotation.delete")
	defer span.End()

	if id == "" {
		return NewValidationError("rotation policy ID is required", ErrIDRequired)
	}

	_, err := uc.rotationService.DeletePolicy(ctx, id)
	if err != nil {
		return NewServiceError("failed to delete rotation policy", err)
	}

	return nil
}

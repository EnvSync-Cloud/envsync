package rotation

import (
	"context"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type triggerRotationUseCase struct {
	rotationService services.RotationService
}

func NewTriggerRotationUseCase() TriggerRotationUseCase {
	return &triggerRotationUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *triggerRotationUseCase) Execute(ctx context.Context, id string) (*sdk.TriggerRotationResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "rotation.trigger")
	defer span.End()

	if id == "" {
		return nil, NewValidationError("rotation policy ID is required", ErrIDRequired)
	}

	result, err := uc.rotationService.TriggerRotation(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to trigger rotation", err)
	}

	return result, nil
}

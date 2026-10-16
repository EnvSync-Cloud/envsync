package rotation

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type triggerRotationUseCase struct {
	rotationService services.RotationService
}

func NewTriggerRotationUseCase() TriggerRotationUseCase {
	return &triggerRotationUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *triggerRotationUseCase) Execute(ctx context.Context, id string) (resp *sdk.TriggerRotationResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "rotation.trigger",
		trace.WithAttributes(attribute.String("rotation.id", id)))
	defer end(&err)

	if id == "" {
		return nil, NewValidationError("rotation policy ID is required", ErrIDRequired)
	}

	result, err := uc.rotationService.TriggerRotation(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to trigger rotation", err)
	}

	return result, nil
}

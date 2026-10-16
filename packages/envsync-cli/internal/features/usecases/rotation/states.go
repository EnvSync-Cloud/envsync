package rotation

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

type getRotationStatesUseCase struct {
	rotationService services.RotationService
}

func NewGetRotationStatesUseCase() GetRotationStatesUseCase {
	return &getRotationStatesUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *getRotationStatesUseCase) Execute(ctx context.Context, id string) (result sdk.RotationStatesResponse, err error) {
	ctx, end := telemetry.StartSpan(ctx, "rotation.states",
		trace.WithAttributes(attribute.String("rotation.id", id)))
	defer end(&err)

	if id == "" {
		return nil, NewValidationError("rotation policy ID is required", ErrIDRequired)
	}

	states, err := uc.rotationService.GetRotationStates(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to get rotation states", err)
	}

	return states, nil
}

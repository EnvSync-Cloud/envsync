package rotation

import (
	"context"

	sdk "github.com/EnvSync-Cloud/envsync/sdks/envsync-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type getRotationStatesUseCase struct {
	rotationService services.RotationService
}

func NewGetRotationStatesUseCase() GetRotationStatesUseCase {
	return &getRotationStatesUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *getRotationStatesUseCase) Execute(ctx context.Context, id string) (sdk.RotationStatesResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "rotation.states")
	defer span.End()

	if id == "" {
		return nil, NewValidationError("rotation policy ID is required", ErrIDRequired)
	}

	states, err := uc.rotationService.GetRotationStates(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to get rotation states", err)
	}

	return states, nil
}

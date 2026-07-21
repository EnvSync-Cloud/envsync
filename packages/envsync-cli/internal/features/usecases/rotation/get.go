package rotation

import (
	"context"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type getPolicyUseCase struct {
	rotationService services.RotationService
}

func NewGetPolicyUseCase() GetPolicyUseCase {
	return &getPolicyUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *getPolicyUseCase) Execute(ctx context.Context, id string) (*sdk.RotationPolicyResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "rotation.get")
	defer span.End()

	if id == "" {
		return nil, NewValidationError("rotation policy ID is required", ErrIDRequired)
	}

	policy, err := uc.rotationService.GetPolicy(ctx, id)
	if err != nil {
		return nil, NewServiceError("failed to get rotation policy", err)
	}

	return policy, nil
}

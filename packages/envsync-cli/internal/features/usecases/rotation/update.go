package rotation

import (
	"context"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type updatePolicyUseCase struct {
	rotationService services.RotationService
}

func NewUpdatePolicyUseCase() UpdatePolicyUseCase {
	return &updatePolicyUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *updatePolicyUseCase) Execute(ctx context.Context, id string, req *sdk.UpdateRotationPolicyRequest) (*sdk.RotationPolicyResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "rotation.update")
	defer span.End()

	if id == "" {
		return nil, NewValidationError("rotation policy ID is required", ErrIDRequired)
	}

	policy, err := uc.rotationService.UpdatePolicy(ctx, id, req)
	if err != nil {
		return nil, NewServiceError("failed to update rotation policy", err)
	}

	return policy, nil
}

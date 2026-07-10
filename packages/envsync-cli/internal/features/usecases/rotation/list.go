package rotation

import (
	"context"

	sdk "github.com/envsync-cloud/envsync-management-go-sdk/sdk"

	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/services"
	"github.com/EnvSync-Cloud/envsync/packages/envsync-cli/internal/telemetry"
)

type listPoliciesUseCase struct {
	rotationService services.RotationService
}

func NewListPoliciesUseCase() ListPoliciesUseCase {
	return &listPoliciesUseCase{
		rotationService: services.NewRotationService(),
	}
}

func (uc *listPoliciesUseCase) Execute(ctx context.Context, req *sdk.GetRotationPoliciesRequest) (sdk.RotationPoliciesResponse, error) {
	ctx, span := telemetry.Tracer().Start(ctx, "rotation.list")
	defer span.End()

	policies, err := uc.rotationService.ListPolicies(ctx, req)
	if err != nil {
		return nil, NewServiceError("failed to list rotation policies", err)
	}

	return policies, nil
}
